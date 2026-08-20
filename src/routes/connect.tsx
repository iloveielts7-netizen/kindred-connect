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

  // Never leave the screen stuck on placeholder dots: fall back to a locally
  // generated ID until the profile arrives.
  const [fallbackId] = useState(() => generateStressId());
  const activeId = profile?.stress_id ?? fallbackId;

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", search: { mode: "signup" } });
  }, [loading, session, navigate]);

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
    if (profile && id === profile.stress_id) {
      toast.error("That's your own Wynse ID.");
      return;
    }
    setBusy(true);

    // Try the backend first; if anything goes wrong (permissions, offline,
    // missing profile) fall back to a local room so the two people can still talk.
    let displayName = id;
    let synced = false;
    try {
      const found = await findByStressId(id);
      if (found) {
        displayName = found.display_name || id;
        if (session) {
          await requestConnection(session.user.id, found.id);
          synced = true;
        }
      }
    } catch (error) {
      console.warn("connection request fell back to local room", errorMessage(error));
    }

    try {
      upsertLocalRoom({ stressId: id, displayName, synced });
      toast.success("Connected!");
      setTarget("");
      void navigate({ to: "/room", search: { id } });
    } catch (error) {
      toast.error(errorMessage(error, "Failed to send request"));
    } finally {
      setBusy(false);
    }
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
