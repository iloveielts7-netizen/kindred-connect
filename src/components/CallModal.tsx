import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CallEngine, type CallQuality, type CallState } from "@/lib/call-engine";

export type CallApi = { startAudio: () => void };

type Props = {
  roomId: string;
  meId: string;
  peerLabel: string;
  onApi?: (api: CallApi | null) => void;
  onClose?: () => void;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function CallModal({ roomId, meId, peerLabel, onApi }: Props) {
  const engineRef = useRef<CallEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<CallState>("idle");
  const [quality, setQuality] = useState<CallQuality>("good");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!roomId || !meId) return;
    const engine = new CallEngine(roomId, meId, {
      onState: setState,
      onRemoteStream: (stream) => {
        if (audioRef.current) {
          audioRef.current.srcObject = stream;
          void audioRef.current.play().catch(() => undefined);
        }
      },
      onLocalStream: () => undefined,
      onQuality: setQuality,
      onIncoming: () => undefined,
      onRemoteVideo: () => undefined,
      onEnded: (reason) => {
        setMuted(false);
        setSeconds(0);
        if (reason === "declined") toast.info("Call declined");
        if (reason === "failed") toast.error("Call failed");
        setTimeout(() => setState("idle"), 600);
      },
    });
    engineRef.current = engine;
    void engine.listen().catch(() => undefined);

    return () => {
      engineRef.current = null;
      void engine.destroy();
    };
  }, [roomId, meId]);

  useEffect(() => {
    onApi?.({
      startAudio: () => {
        const engine = engineRef.current;
        if (!engine) {
          toast.error("Calling is not ready yet");
          return;
        }
        void engine.start("audio").catch(() => toast.error("Could not start the call"));
      },
    });
    return () => onApi?.(null);
  }, [onApi]);

  useEffect(() => {
    if (state !== "connected") return;
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const visible = state !== "idle";

  function accept() {
    void engineRef.current?.accept().catch(() => toast.error("Microphone unavailable"));
  }

  function decline() {
    engineRef.current?.decline();
  }

  function hangUp() {
    engineRef.current?.hangUp();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }

  const status =
    state === "ringing-out"
      ? "Calling…"
      : state === "ringing-in"
        ? "Incoming call"
        : state === "connecting"
          ? "Connecting…"
          : state === "reconnecting"
            ? "Reconnecting…"
            : state === "connected"
              ? formatDuration(seconds)
              : "Call ended";

  return (
    <>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {visible ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 backdrop-blur-xl">
          <div className="relative flex size-40 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            <span className="absolute inset-4 rounded-full bg-primary/10" />
            <span className="relative font-display text-xl tracking-[0.16em] text-primary">
              {peerLabel.slice(0, 8)}
            </span>
          </div>

          <p className="mt-8 font-display text-lg tracking-[0.14em]">{peerLabel}</p>
          <p className="mt-2 text-sm text-muted-foreground">{status}</p>
          {state === "connected" ? (
            <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              Signal {quality}
            </p>
          ) : null}

          <div className="mt-12 flex items-center gap-4">
            {state === "ringing-in" ? (
              <>
                <Button
                  size="icon"
                  className="size-16 rounded-full"
                  onClick={accept}
                  aria-label="Accept call"
                >
                  <Phone className="size-6" />
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="size-16 rounded-full"
                  onClick={decline}
                  aria-label="Decline call"
                >
                  <PhoneOff className="size-6" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-14 rounded-full"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                >
                  {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </Button>
                <Button
                  size="icon"
                  variant="destructive"
                  className="size-16 rounded-full"
                  onClick={hangUp}
                  aria-label="End call"
                >
                  <PhoneOff className="size-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
