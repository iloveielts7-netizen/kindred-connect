import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { ensureCloudRoom, rememberMyStressId } from "@/lib/cloud-rooms";
import {
  fetchRequest,
  respondToConnectionRequest,
  sendConnectionRequest,
  subscribeOutgoingRequests,
} from "@/lib/connection-requests";
import { errorMessage, upsertLocalRoom } from "@/lib/local-rooms";
import { findByStressId, requestConnection } from "@/lib/rooms";
import { generateStressId } from "@/lib/stress-id";
import { isValidStressId, normalizeStressId, stressIdLink } from "@/lib/stress-id";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/connect")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your Wynse ID — connect with one person" },
      {
        name: "description",
        content:
          "Show your Wynse ID and QR code, or enter someone else's ID to open a private one-to-one room.",
      },
      { property: "og:title", content: "Your Wynse ID — Wynse" },
      {
        property: "og:description",
        content: "Share your Wynse ID or QR code to start a private room for two.",
      },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const navigate = useNavigate();
  const { session, loading, profile } = useAuth();
  const search = Route.useSearch();

  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [target, setTarget] = useState(search.id ? normalizeStressId(search.id) : "");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    id: string;
    peerId: string;
    displayName: string;
  } | null>(null);

  // Never leave the screen stuck on placeholder dots: fall back to a locally
  // generated ID until the profile arrives.
  const [fallbackId] = useState(() => generateStressId());
  const activeId = profile?.stress_id ?? fallbackId;

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", search: { mode: "signup" } });
  }, [loading, session, navigate]);

  // Remember my Wynse ID so the room view can derive the canonical room id.
  useEffect(() => {
    rememberMyStressId(activeId);
  }, [activeId]);


  useEffect(() => {
    let active = true;
    setQr(null);
    setQrFailed(false);
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const url = await QRCode.toDataURL(stressIdLink(activeId), {
          margin: 1,
          width: 512,
          color: { dark: "#0D0F12", light: "#FFFFFF" },
        });
        if (active) setQr(url);
      } catch (error) {
        console.error("QR render failed", error);
        if (active) setQrFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeId]);

  // Watch the request I sent: the moment they accept, both devices land in the
  // same canonical room.
  useEffect(() => {
    if (!pending) return;
    let active = true;

    async function enter() {
      if (!active || !pending) return;
      active = false;
      try {
        await ensureCloudRoom({
          myId: activeId,
          peerId: pending.peerId,
          myName: profile?.display_name ?? activeId,
          peerName: pending.displayName,
        });
      } catch (error) {
        console.warn("cloud room fallback", errorMessage(error));
      }
      upsertLocalRoom({ stressId: pending.peerId, displayName: pending.displayName, synced: true });
      const peerId = pending.peerId;
      setPending(null);
      toast.success("Request accepted — opening your room.");
      void navigate({ to: "/room", search: { id: peerId } });
    }

    const unsubscribe = subscribeOutgoingRequests(activeId, (request) => {
      if (request.id !== pending.id) return;
      if (request.status === "accepted") void enter();
      if (request.status === "rejected") {
        setPending(null);
        toast.error("Your request was declined.");
      }
    });

    // Safety net in case the realtime socket drops.
    const poll = window.setInterval(() => {
      void (async () => {
        try {
          const row = await fetchRequest(pending.id);
          if (row?.status === "accepted") void enter();
          if (row?.status === "rejected") {
            setPending(null);
            toast.error("Your request was declined.");
          }
        } catch {
          /* ignore */
        }
      })();
    }, 4000);

    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [pending, activeId, profile?.display_name, navigate]);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(activeId);
      setCopied(true);
      toast.success("Wynse ID copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy — select the ID manually.");
    }
  }

  async function shareId() {
    const link = stressIdLink(activeId);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Wynse", text: activeId, url: link });
        return;
      } catch {
        /* user dismissed */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Wynse ID copied to clipboard");
    } catch {
      toast.error("Couldn't share this ID.");
    }
  }


  async function send(event: React.FormEvent) {
    event.preventDefault();
    const id = normalizeStressId(target);
    if (!isValidStressId(id)) {
      toast.error("Enter a full Wynse ID, like ABCD-1234-EFGH.");
      return;
    }
    if (id === activeId) {
      toast.error("That's your own Wynse ID.");
      return;
    }
    setBusy(true);

    let displayName = id;
    try {
      const found = await findByStressId(id);
      if (found) displayName = found.display_name || id;
      if (found && session) {
        try {
          await requestConnection(session.user.id, found.id);
        } catch (error) {
          console.warn("connection row skipped", errorMessage(error, "request failed"));
        }
      }
    } catch (error) {
      console.warn("profile lookup skipped", errorMessage(error));
    }

    try {
      const request = await sendConnectionRequest(activeId, id);
      setPending({ id: request.id, peerId: id, displayName });
      setTarget("");
      toast.success("Request sent — waiting for them to accept.");
    } catch (error) {
      // Backend unavailable: fall back to a local room so the pair can still talk.
      console.warn("connection request fell back to local room", errorMessage(error));
      upsertLocalRoom({ stressId: id, displayName, synced: false });
      toast.success("Connected!");
      setTarget("");
      void navigate({ to: "/room", search: { id } });
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending() {
    if (!pending) return;
    try {
      await respondToConnectionRequest(pending.id, false);
    } catch {
      /* best effort */
    }
    setPending(null);
  }


  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5 safe-t">
        <Link to="/" aria-label="Wynse home">
          <Wordmark />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/rooms">Rooms</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
        <h1 className="text-2xl">Connect with Wynse</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Share your unique ID or QR code to initiate a secure connection.
        </p>

        <section className="panel rise mt-6 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            YOUR WYNSE ID
          </p>

          <div className="mx-auto mt-5 flex size-56 items-center justify-center overflow-hidden rounded-2xl border border-border bg-foreground p-3">
            {qr ? (
              <img src={qr} alt="QR code for your Wynse ID" className="size-full" />
            ) : qrFailed ? (
              <svg viewBox="0 0 33 33" className="size-full" role="img" aria-label="Wynse ID code">
                <rect width="33" height="33" fill="#FFFFFF" />
                {Array.from({ length: 33 * 33 }, (_, i) => {
                  const x = i % 33;
                  const y = Math.floor(i / 33);
                  const c = activeId.charCodeAt((x * 7 + y * 13) % activeId.length);
                  return (c + x * 3 + y * 5) % 3 === 0 ? (
                    <rect key={i} x={x} y={y} width="1" height="1" fill="#0D0F12" />
                  ) : null;
                })}
              </svg>
            ) : (
              <Loader2 className="size-6 animate-spin text-background" />
            )}
          </div>

          <p className="mt-5 font-display text-2xl tracking-[0.16em] text-foreground">{activeId}</p>


          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="h-11 flex-1" onClick={() => void copyId()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy ID"}
            </Button>
            <Button variant="secondary" className="h-11 flex-1" onClick={() => void shareId()}>
              <Share2 className="size-4" />
              Share ID
            </Button>
          </div>
        </section>

        <form className="panel mt-5 space-y-3 p-6" onSubmit={send}>
          <Label htmlFor="stress-id">Enter Recipient ID</Label>
          <Input
            id="stress-id"
            value={target}
            onChange={(e) => setTarget(normalizeStressId(e.target.value))}
            placeholder="ABCD-1234-EFGH"
            className="h-12 text-center font-display text-lg tracking-[0.16em]"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? "Sending…" : "Send Request"}
          </Button>
        </form>
      </main>
    </div>
  );
}
