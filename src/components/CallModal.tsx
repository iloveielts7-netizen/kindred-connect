import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

type CallModalProps = {
  isOpen: boolean;
  roomId: string;
  currentUserId: string;
  /** "incoming" when this device received the call invite. */
  initialState?: "ringing" | "incoming";
  onClose: () => void;
};

function formatTime(sec: number) {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function CallModal({
  isOpen,
  roomId,
  currentUserId,
  initialState = "ringing",
  onClose,
}: CallModalProps) {
  const [callState, setCallState] = useState<"ringing" | "connected" | "incoming">(initialState);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const closedRef = useRef(false);

  const teardown = useCallback((notifyPeer: boolean) => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) {
      if (notifyPeer) {
        void channel.send({
          type: "broadcast",
          event: "hangup",
          payload: { sender: currentUserId },
        });
      }
      void supabase.removeChannel(channel);
    }
  }, [currentUserId]);

  const endCall = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    teardown(true);
    onClose();
  }, [teardown, onClose]);

  useEffect(() => {
    if (!isOpen || !roomId || !currentUserId) return;
    closedRef.current = false;
    setCallState(initialState);
    setDuration(0);
    setIsMuted(false);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        void channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON(), sender: currentUserId },
        });
      }
    };

    void navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      })
      .catch((err) => console.error("Mic access denied:", err));

    const channel = supabase.channel(`call-signal-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "call-accepted" }, async () => {
        setCallState("connected");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void channel.send({
          type: "broadcast",
          event: "sdp-offer",
          payload: { offer, sender: currentUserId },
        });
      })
      .on("broadcast", { event: "sdp-offer" }, async ({ payload }) => {
        if (payload.sender === currentUserId) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        void channel.send({
          type: "broadcast",
          event: "sdp-answer",
          payload: { answer, sender: currentUserId },
        });
        setCallState("connected");
      })
      .on("broadcast", { event: "sdp-answer" }, async ({ payload }) => {
        if (payload.sender === currentUserId) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.sender === currentUserId || !payload.candidate) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          // ignore late/duplicate candidates
        }
      })
      .on("broadcast", { event: "hangup" }, () => {
        if (closedRef.current) return;
        closedRef.current = true;
        teardown(false);
        onClose();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && initialState === "ringing") {
          void channel.send({
            type: "broadcast",
            event: "call-invite",
            payload: { sender: currentUserId },
          });
        }
      });

    return () => {
      closedRef.current = true;
      teardown(false);
    };
  }, [isOpen, roomId, currentUserId, initialState, teardown, onClose]);

  useEffect(() => {
    if (callState !== "connected") return;
    const timer = window.setInterval(() => setDuration((d) => d + 1), 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  function acceptCall() {
    setCallState("connected");
    void channelRef.current?.send({
      type: "broadcast",
      event: "call-accepted",
      payload: { sender: currentUserId },
    });
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = isMuted;
    setIsMuted(!isMuted);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#090e13]/95 p-8 text-white backdrop-blur-md">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="mt-12 flex flex-col items-center">
        <div className="flex size-24 animate-pulse items-center justify-center rounded-full border-2 border-[#00f2ff] bg-[#121a22] shadow-[0_0_30px_rgba(0,242,255,0.3)]">
          <Volume2 className="size-10 text-[#00f2ff]" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-wide">Wynse Secure Call</h2>
        <p className="mt-2 text-sm text-[#80e8ff]">
          {callState === "ringing" && "Calling secure peer..."}
          {callState === "incoming" && "Incoming encrypted call..."}
          {callState === "connected" && `Connected • ${formatTime(duration)}`}
        </p>
      </div>

      <div className="mb-12 flex items-center gap-6">
        {callState === "incoming" ? (
          <>
            <button
              onClick={acceptCall}
              className="rounded-full bg-emerald-500 px-6 py-3 font-semibold shadow-lg hover:bg-emerald-600"
            >
              Accept
            </button>
            <button
              onClick={endCall}
              className="rounded-full bg-rose-500 px-6 py-3 font-semibold shadow-lg hover:bg-rose-600"
            >
              Decline
            </button>
          </>
        ) : (
          <>
            <button
              onClick={toggleMute}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              className={`rounded-full border border-[#1e2d3d] p-4 ${
                isMuted ? "bg-rose-500/20 text-rose-400" : "bg-[#121a22] text-[#00f2ff]"
              }`}
            >
              {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <button
              onClick={endCall}
              aria-label="End call"
              className="rounded-full bg-rose-600 p-4 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:bg-rose-700"
            >
              <PhoneOff className="size-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
