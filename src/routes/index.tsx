import { Link, createFileRoute } from "@tanstack/react-router";
import { KeyRound, Lock, MessageCircle, PhoneCall, ScanLine, ShieldCheck, Video } from "lucide-react";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Wynse — Safe Exchange" },
      {
        name: "description",
        content:
          "Two people, one private connection. End-to-end encrypted messages plus real HD audio and video calls, with no contact upload.",
      },
      { property: "og:title", content: "Wynse — Safe Exchange" },
      {
        property: "og:description",
        content:
          "End-to-end encrypted one-to-one messaging and real WebRTC HD calls. No contact upload, no call recording.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();

  return (
    <div className="min-h-screen room-glow">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 safe-t">
        <Wordmark />
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link to="/security">Security</Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to={session ? "/rooms" : "/auth"}>{session ? "Rooms" : "Sign In"}</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-20">
        <section className="rise pt-10 sm:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            WYNSE MESSENGER
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl leading-[1.05] sm:text-6xl">
            Private Communication, Simplified
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Safe Exchange
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 text-base">
              <Link to="/connect">Get Started</Link>
            </Button>

            {!session && !loading ? (
              <Button asChild size="lg" variant="secondary" className="h-12 text-base">
                <Link to="/auth" search={{ mode: "signin" }}>
                  Sign In
                </Link>
              </Button>
            ) : null}
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-3">
          <Feature
            icon={<Lock className="size-5" />}
            title="End-to-End Security"
            body="Your messages stay strictly between you and your recipient."
          />
          <Feature
            icon={<Video className="size-5" />}
            title="Real HD Calls"
            body="Crisp audio and HD video, peer-to-peer, with nothing recorded."
          />
          <Feature
            icon={<ScanLine className="size-5" />}
            title="Connect by QR"
            body="Share a Wynse ID or scan a QR code. No contact upload, ever."
          />
        </section>

        <section className="panel mt-6 p-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
            <Step icon={<KeyRound className="size-4" />} label="Person" />
            <Step icon={<ShieldCheck className="size-4" />} label="Private room" />
            <Step icon={<MessageCircle className="size-4" />} label="Message" />
            <Step icon={<PhoneCall className="size-4" />} label="Audio call" />
            <Step icon={<Video className="size-4" />} label="Video call" />
          </div>
        </section>

        <section className="panel mt-6 p-6">
          <h2 className="text-lg">Honest about privacy</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Message content and files are encrypted on your device, so the server only ever stores
            ciphertext. It still knows who talks to whom and when, because that is what delivery
            requires — we would rather say so plainly than promise magic.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/security">Security</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/privacy">Privacy</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/terms">Terms</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center font-display text-sm tracking-[0.18em] text-muted-foreground">
          Wynse — Safe Exchange
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="panel p-5">
      <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </span>
      <h2 className="mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span className="text-foreground">{label}</span>
    </span>
  );
}
