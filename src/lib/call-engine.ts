/**
 * One-to-one WebRTC calling.
 *
 * Media is encrypted in transit by WebRTC itself (DTLS-SRTP) and flows
 * peer-to-peer when the network allows, falling back to a TURN relay.
 * Signalling (offer/answer/ICE) travels over an unguessable realtime channel
 * named after the room id; no call content is ever stored and calls are
 * never recorded.
 *
 * TURN is optional but strongly recommended for mobile networks. Configure:
 *   VITE_TURN_URLS=turns:turn.example.com:5349
 *   VITE_TURN_USERNAME=...
 *   VITE_TURN_CREDENTIAL=...
 * Without it, calls still work on most Wi-Fi networks via STUN only.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type CallMode = "audio" | "video";
export type CallState =
  | "idle"
  | "ringing-out"
  | "ringing-in"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended";
export type CallQuality = "good" | "fair" | "weak";

export type CallEvents = {
  onState: (state: CallState) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream | null) => void;
  onQuality: (quality: CallQuality) => void;
  onIncoming: (mode: CallMode, fromUserId: string) => void;
  onEnded: (reason: "hangup" | "declined" | "failed") => void;
  onRemoteVideo: (enabled: boolean) => void;
};

type SignalPayload =
  | { type: "invite"; mode: CallMode; from: string }
  | { type: "accept"; from: string }
  | { type: "decline"; from: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; from: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; from: string }
  | { type: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { type: "video"; enabled: boolean; from: string }
  | { type: "bye"; from: string };

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
  ];
  const turnUrls = import.meta.env['VITE_TURN_URLS'] as string | undefined;
  const username = import.meta.env['VITE_TURN_USERNAME'] as string | undefined;
  const credential = import.meta.env['VITE_TURN_CREDENTIAL'] as string | undefined;
  if (turnUrls && username && credential) {
    servers.push({ urls: turnUrls.split(",").map((u) => u.trim()), username, credential });
  }
  return servers;
}

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 30, max: 30 },
  facingMode: "user",
};

export class CallEngine {
  private pc: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private local: MediaStream | null = null;
  private remote = new MediaStream();
  private pendingIce: RTCIceCandidateInit[] = [];
  private statsTimer: number | null = null;
  private mode: CallMode = "audio";
  private isCaller = false;
  private facing: "user" | "environment" = "user";
  private state: CallState = "idle";

  constructor(
    private readonly roomId: string,
    private readonly meId: string,
    private readonly events: CallEvents,
  ) {}

  /** Joins the room's signalling channel; required to receive calls. */
  async listen() {
    if (this.channel) return;
    const channel = supabase.channel(`stress-call:${this.roomId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void this.handleSignal(payload as SignalPayload);
    });
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
      });
    });
    this.channel = channel;
  }

  private send(payload: SignalPayload) {
    void this.channel?.send({ type: "broadcast", event: "signal", payload });
  }

  private setState(state: CallState) {
    this.state = state;
    this.events.onState(state);
  }

  private async getLocalStream(mode: CallMode) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONSTRAINTS,
      video: mode === "video" ? { ...VIDEO_CONSTRAINTS, facingMode: this.facing } : false,
    });
    this.local = stream;
    this.events.onLocalStream(stream);
    return stream;
  }

  private createPeer() {
    const pc = new RTCPeerConnection({
      iceServers: iceServers(),
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({ type: "ice", candidate: event.candidate.toJSON(), from: this.meId });
      }
    };
    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remote.getTracks().some((t) => t.id === track.id)) this.remote.addTrack(track);
      });
      this.events.onRemoteStream(this.remote);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        this.setState("connected");
        this.startStats();
      } else if (pc.connectionState === "disconnected") {
        this.setState("reconnecting");
      } else if (pc.connectionState === "failed") {
        void this.restartIce();
      }
    };
    this.pc = pc;
    return pc;
  }

  private async restartIce() {
    if (!this.pc || !this.isCaller) {
      this.setState("reconnecting");
      return;
    }
    try {
      this.setState("reconnecting");
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.send({ type: "offer", sdp: offer, from: this.meId });
    } catch {
      this.hangUp("failed");
    }
  }

  /** Adaptive bitrate/resolution: shrink video first, protect audio last. */
  private startStats() {
    if (this.statsTimer) window.clearInterval(this.statsTimer);
    let lastBytes = 0;
    let lastAt = Date.now();
    this.statsTimer = window.setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      const stats = await pc.getStats();
      let lossRatio = 0;
      let bytes = 0;
      stats.forEach((report) => {
        if (report.type === "outbound-rtp" && !report.isRemote) bytes += report.bytesSent ?? 0;
        if (report.type === "remote-inbound-rtp") {
          const lost = report.packetsLost ?? 0;
          const sent = (report.packetsSent as number) || 1;
          lossRatio = Math.max(lossRatio, lost / Math.max(sent, 1));
        }
      });
      const now = Date.now();
      const kbps = ((bytes - lastBytes) * 8) / Math.max(now - lastAt, 1);
      lastBytes = bytes;
      lastAt = now;

      const quality: CallQuality = lossRatio > 0.08 ? "weak" : lossRatio > 0.03 ? "fair" : "good";
      this.events.onQuality(quality);
      await this.applyQuality(quality, kbps);
    }, 3000);
  }

  private async applyQuality(quality: CallQuality, _kbps: number) {
    const sender = this.pc?.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;
    const params = sender.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    const encoding = params.encodings[0]!;
    if (quality === "weak") {
      encoding.maxBitrate = 180_000;
      encoding.scaleResolutionDownBy = 4;
    } else if (quality === "fair") {
      encoding.maxBitrate = 700_000;
      encoding.scaleResolutionDownBy = 2;
    } else {
      encoding.maxBitrate = 2_500_000;
      encoding.scaleResolutionDownBy = 1;
    }
    encoding.networkPriority = "high";
    try {
      await sender.setParameters(params);
    } catch {
      /* browsers differ; ignore unsupported params */
    }
  }

  async start(mode: CallMode) {
    await this.listen();
    this.mode = mode;
    this.isCaller = true;
    this.setState("ringing-out");
    this.send({ type: "invite", mode, from: this.meId });
  }

  async accept() {
    await this.listen();
    this.isCaller = false;
    this.setState("connecting");
    const stream = await this.getLocalStream(this.mode);
    const pc = this.createPeer();
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    this.send({ type: "accept", from: this.meId });
  }

  decline() {
    this.send({ type: "decline", from: this.meId });
    this.cleanup();
    this.setState("idle");
  }

  hangUp(reason: "hangup" | "failed" = "hangup") {
    this.send({ type: "bye", from: this.meId });
    this.cleanup();
    this.setState("ended");
    this.events.onEnded(reason);
  }

  setMuted(muted: boolean) {
    this.local?.getAudioTracks().forEach((track) => (track.enabled = !muted));
  }

  setCameraEnabled(enabled: boolean) {
    this.local?.getVideoTracks().forEach((track) => (track.enabled = enabled));
    this.send({ type: "video", enabled, from: this.meId });
  }

  async switchCamera() {
    if (!this.local || !this.pc) return;
    this.facing = this.facing === "user" ? "environment" : "user";
    const next = await navigator.mediaDevices.getUserMedia({
      video: { ...VIDEO_CONSTRAINTS, facingMode: this.facing },
    });
    const track = next.getVideoTracks()[0];
    if (!track) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    await sender?.replaceTrack(track);
    this.local.getVideoTracks().forEach((old) => {
      old.stop();
      this.local?.removeTrack(old);
    });
    this.local.addTrack(track);
    this.events.onLocalStream(this.local);
  }

  getMode() {
    return this.mode;
  }

  getState() {
    return this.state;
  }

  private async handleSignal(payload: SignalPayload) {
    if (payload.from === this.meId) return;
    switch (payload.type) {
      case "invite": {
        if (this.state !== "idle" && this.state !== "ended") {
          this.send({ type: "decline", from: this.meId });
          return;
        }
        this.mode = payload.mode;
        this.setState("ringing-in");
        this.events.onIncoming(payload.mode, payload.from);
        return;
      }
      case "accept": {
        if (!this.isCaller) return;
        this.setState("connecting");
        const stream = await this.getLocalStream(this.mode);
        const pc = this.createPeer();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.send({ type: "offer", sdp: offer, from: this.meId });
        return;
      }
      case "decline": {
        this.cleanup();
        this.setState("idle");
        this.events.onEnded("declined");
        return;
      }
      case "offer": {
        const pc = this.pc ?? this.createPeer();
        if (!this.local) {
          const stream = await this.getLocalStream(this.mode);
          stream.getTracks().forEach((track) => {
            if (!pc.getSenders().some((s) => s.track?.kind === track.kind)) {
              pc.addTrack(track, stream);
            }
          });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send({ type: "answer", sdp: answer, from: this.meId });
        return;
      }
      case "answer": {
        if (!this.pc) return;
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.flushIce();
        return;
      }
      case "ice": {
        if (!this.pc?.remoteDescription) {
          this.pendingIce.push(payload.candidate);
          return;
        }
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch {
          /* stale candidate */
        }
        return;
      }
      case "video": {
        this.events.onRemoteVideo(payload.enabled);
        return;
      }
      case "bye": {
        this.cleanup();
        this.setState("ended");
        this.events.onEnded("hangup");
        return;
      }
    }
  }

  private async flushIce() {
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      try {
        await this.pc?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore */
      }
    }
  }

  private cleanup() {
    if (this.statsTimer) window.clearInterval(this.statsTimer);
    this.statsTimer = null;
    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;
    this.events.onLocalStream(null);
    this.remote.getTracks().forEach((track) => this.remote.removeTrack(track));
    this.pc?.close();
    this.pc = null;
    this.pendingIce = [];
    this.isCaller = false;
  }

  async destroy() {
    this.cleanup();
    if (this.channel) await supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
