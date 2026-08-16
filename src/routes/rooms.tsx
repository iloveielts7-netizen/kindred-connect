import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Your private rooms — STRESS" },
      {
        name: "description",
        content: "Open a private one-to-one room, or share your STRESS ID to connect with someone.",
      },
      { property: "og:title", content: "Your private rooms — STRESS" },
      { property: "og:description", content: "One room, two people, end-to-end encrypted." },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, loading, profile, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5 safe-t">
        <Link to="/" aria-label="STRESS home">
          <Wordmark />
        </Link>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          {t("settings.signOut", { defaultValue: "Sign out" })}
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        <h1 className="text-2xl">{t("rooms.title", { defaultValue: "Rooms" })}</h1>
        <div className="panel mt-5 p-5">
          <p className="text-sm text-muted-foreground">
            {t("rooms.empty", { defaultValue: "No rooms yet. Share your STRESS ID to connect." })}
          </p>
          {profile ? (
            <p className="mt-4 font-display text-lg tracking-[0.18em]">{profile.stress_id}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
