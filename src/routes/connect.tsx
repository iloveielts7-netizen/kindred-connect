import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { findByStressId, requestConnection } from "@/lib/rooms";
import { isValidStressId, normalizeStressId, stressIdLink } from "@/lib/stress-id";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/connect")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Your STRESS ID — connect with one person" },
      {
        name: "description",
        content:
          "Show your STRESS ID and QR code, or enter someone else's ID to open a private one-to-one room.",
      },
      { property: "og:title", content: "Your STRESS ID — STRESS" },
      {
        property: "og:description",
        content: "Share your STRESS ID or QR code to start a private room for two.",
      },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, loading, profile } = useAuth();
  const search = Route.useSearch();

  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [target, setTarget] = useState(search.id ? normalizeStressId(search.id) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", search: { mode: "signup" } });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!profile?.stress_id) return;
    let active = true;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(stressIdLink(profile.stress_id), {
        margin: 1,
        width: 512,
        color: { dark: "#0D0F12", light: "#FFFFFF" },
      });
      if (active) setQr(url);
    })();
    return () => {
      active = false;
    };
  }, [profile?.stress_id]);

  async function copyId() {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.stress_id);
    setCopied(true);
    toast.success(t("common.copied"));
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function shareId() {
    if (!profile) return;
    const link = stressIdLink(profile.stress_id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "STRESS", text: profile.stress_id, url: link });
        return;
      } catch {
        /* user dismissed */
      }
    }
    await navigator.clipboard.writeText(link);
    toast.success(t("common.copied"));
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !profile) return;
    const id = normalizeStressId(target);
    if (!isValidStressId(id)) {
      toast.error(t("connect.notFound"));
      return;
    }
    if (id === profile.stress_id) {
      toast.error(t("connect.self"));
      return;
    }
    setBusy(true);
    try {
      const found = await findByStressId(id);
      if (!found) {
        toast.error(t("connect.notFound"));
        return;
      }
      await requestConnection(session.user.id, found.id);
      toast.success(t("connect.sent"));
      setTarget("");
      void navigate({ to: "/rooms" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("duplicate") || message.includes("unique")) {
        toast.error(t("connect.exists"));
      } else {
        toast.error(t("common.somethingWrong"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5 safe-t">
        <Link to="/" aria-label="STRESS home">
          <Wordmark />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/rooms">{t("rooms.title")}</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
        <h1 className="text-2xl">{t("connect.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("connect.body")}</p>

        <section className="panel rise mt-6 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            {t("connect.yourId")}
          </p>

          <div className="mx-auto mt-5 flex size-56 items-center justify-center overflow-hidden rounded-2xl border border-border bg-foreground p-3">
            {qr ? (
              <img src={qr} alt={t("connect.scan")} className="size-full" />
            ) : (
              <Loader2 className="size-6 animate-spin text-background" />
            )}
          </div>

          <p className="mt-5 font-display text-2xl tracking-[0.16em] text-foreground">
            {profile?.stress_id ?? "····-····-····"}
          </p>

          <div className="mt-5 flex gap-2">
            <Button variant="secondary" className="h-11 flex-1" onClick={() => void copyId()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
            <Button variant="secondary" className="h-11 flex-1" onClick={() => void shareId()}>
              <Share2 className="size-4" />
              {t("connect.shareId")}
            </Button>
          </div>
        </section>

        <form className="panel mt-5 space-y-3 p-6" onSubmit={send}>
          <Label htmlFor="stress-id">{t("connect.enterId")}</Label>
          <Input
            id="stress-id"
            value={target}
            onChange={(e) => setTarget(normalizeStressId(e.target.value))}
            placeholder={t("connect.placeholder")}
            className="h-12 text-center font-display text-lg tracking-[0.16em]"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? t("common.loading") : t("connect.send")}
          </Button>
        </form>
      </main>
    </div>
  );
}
