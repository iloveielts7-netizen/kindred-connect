import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  AlertCircle,
  PhoneCall,
  Video,
  VideoOff,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';

interface CallModalProps {
  isOpen: boolean;
  roomId: string;
  currentUserId: string;
  /** "incoming" when this device received the call invite. */
  initialState?: 'ringing' | 'incoming';
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  roomId,
  currentUserId,
  initialState = 'ringing',
  onClose,
}) => {
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'incoming' | 'failed'>(initialState);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const channelRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);
  const closedRef = useRef(false);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const startRingingSound = (type: 'calling' | 'incoming') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      stopRingingSound();
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const playTone = () => {
        if (ctx.state === 'suspended') void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(type === 'calling' ? 440 : 659.25, ctx.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      };

      playTone();
      ringIntervalRef.current = setInterval(playTone, type === 'calling' ? 3000 : 2000);
    } catch (e) {
      console.log('AudioContext failed:', e);
    }
  };

  const stopRingingSound = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const cleanupAndClose = (notifyPeer = true) => {
    if (closedRef.current) return;
    closedRef.current = true;
    stopRingingSound();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (channelRef.current) {
      if (notifyPeer) {
        void channelRef.current.send({
          type: 'broadcast',
          event: 'hangup',
          payload: { sender: currentUserId },
        });
      }
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      stopRingingSound();
      return;
    }

    let isMounted = true;
    closedRef.current = false;
    setCallState(initialState);
    setDuration(0);
    setIsMuted(false);
    setIsCameraOn(true);
    setHasRemoteVideo(false);
    setErrorMessage(null);
    startRingingSound(initialState === 'incoming' ? 'incoming' : 'calling');

    const initCall = async () => {
      try {
        // HD video + audio; fall back to audio-only if no camera is available.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        }
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setIsCameraOn(stream.getVideoTracks().length > 0);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        });
        peerConnectionRef.current = pc;

        // CRITICAL: Attach local mic tracks so remote peer receives audio
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch((e) => console.log('Audio play error:', e));
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && channelRef.current) {
            void channelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: { candidate: event.candidate.toJSON(), sender: currentUserId },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            stopRingingSound();
            setCallState('connected');
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            stopRingingSound();
            setCallState('failed');
            setErrorMessage('Peer connection dropped.');
          }
        };

        const channel = supabase.channel(`call-signal-${roomId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel
          .on('broadcast', { event: 'call-invite' }, async ({ payload }) => {
            if (payload.sender !== currentUserId && callStateRef.current !== 'connected') {
              setCallState('incoming');
              stopRingingSound();
              startRingingSound('incoming');
            }
          })
          .on('broadcast', { event: 'call-accepted' }, async ({ payload }) => {
            if (payload.sender !== currentUserId) {
              stopRingingSound();
              setCallState('connected');
              try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                void channel.send({
                  type: 'broadcast',
                  event: 'sdp-offer',
                  payload: { offer, sender: currentUserId },
                });
              } catch (e) {
                console.error('Error creating offer:', e);
              }
            }
          })
          .on('broadcast', { event: 'sdp-offer' }, async ({ payload }) => {
            if (payload.sender !== currentUserId) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                void channel.send({
                  type: 'broadcast',
                  event: 'sdp-answer',
                  payload: { answer, sender: currentUserId },
                });
                stopRingingSound();
                setCallState('connected');
              } catch (e) {
                console.error('Error handling offer:', e);
              }
            }
          })
          .on('broadcast', { event: 'sdp-answer' }, async ({ payload }) => {
            if (payload.sender !== currentUserId) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                stopRingingSound();
                setCallState('connected');
              } catch (e) {
                console.error('Error handling answer:', e);
              }
            }
          })
          .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            if (payload.sender !== currentUserId && payload.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } catch (e) {
                console.error('Error adding ice candidate:', e);
              }
            }
          })
          .on('broadcast', { event: 'hangup' }, () => {
            cleanupAndClose(false);
          })
          .subscribe((status) => {
            // Only the caller sends the invite; the receiver opened this modal
            // because it already heard one.
            if (status === 'SUBSCRIBED' && initialState === 'ringing') {
              void channel.send({
                type: 'broadcast',
                event: 'call-invite',
                payload: { sender: currentUserId },
              });
            }
          });
      } catch (err: any) {
        console.error('Mic/WebRTC error:', err);
        stopRingingSound();
        setCallState('failed');
        setErrorMessage(err.message || 'Microphone access denied.');
      }
    };

    void initCall();

    return () => {
      isMounted = false;
      stopRingingSound();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roomId, currentUserId, initialState]);

  useEffect(() => {
    let timer: any;
    if (callState === 'connected') {
      timer = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const acceptCall = async () => {
    stopRingingSound();
    setCallState('connected');
    if (channelRef.current) {
      void channelRef.current.send({
        type: 'broadcast',
        event: 'call-accepted',
        payload: { sender: currentUserId },
      });
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      const nextSpeakerState = !isSpeakerOn;
      setIsSpeakerOn(nextSpeakerState);
      remoteAudioRef.current.volume = nextSpeakerState ? 1.0 : 0.6;
    }
  };

  if (!isOpen) return null;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090e13]/95 backdrop-blur-md flex flex-col items-center justify-between p-8 text-white">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="flex flex-col items-center mt-12">
        <div
          className={`w-24 h-24 rounded-full bg-[#121a22] border-2 ${callState === 'failed' ? 'border-rose-500' : 'border-[#00f2ff]'} flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(0,242,255,0.3)]`}
        >
          {callState === 'failed' ? (
            <AlertCircle className="w-10 h-10 text-rose-500" />
          ) : (
            <PhoneCall className="w-10 h-10 text-[#00f2ff]" />
          )}
        </div>
        <h2 className="text-2xl font-semibold mt-6 tracking-wide">Wynse Secure Call</h2>
        <p className={`mt-2 text-sm ${callState === 'failed' ? 'text-rose-400' : 'text-[#80e8ff]'}`}>
          {callState === 'ringing' && 'Calling secure peer...'}
          {callState === 'incoming' && 'Incoming encrypted call...'}
          {callState === 'connected' && `Connected • ${formatTime(duration)}`}
          {callState === 'failed' && (errorMessage || 'Connection failed.')}
        </p>
      </div>

      <div className="flex items-center gap-6 mb-12">
        {callState === 'incoming' ? (
          <>
            <button
              onClick={() => void acceptCall()}
              className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 font-semibold shadow-lg"
            >
              Accept
            </button>
            <button
              onClick={() => cleanupAndClose()}
              className="px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-600 font-semibold shadow-lg"
            >
              Decline
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`p-4 rounded-full border border-[#1e2d3d] ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-[#121a22] text-[#00f2ff]'}`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={toggleSpeaker}
              aria-label={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
              className={`p-4 rounded-full border border-[#1e2d3d] ${isSpeakerOn ? 'bg-[#00f2ff]/20 text-[#00f2ff]' : 'bg-[#121a22] text-gray-400'}`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button
              onClick={() => cleanupAndClose()}
              aria-label="End call"
              className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
