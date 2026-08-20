import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { listLocalRooms, subscribeLocalRooms, type LocalRoom } from "@/lib/local-rooms";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Your private rooms — Wynse" },
      {
        name: "description",
        content: "Open a private one-to-one room, or share your Wynse ID to connect with someone.",
      },
      { property: "og:title", content: "Your private rooms — Wynse" },
      { property: "og:description", content: "One room, two people, end-to-end encrypted." },
    ],
  }),
  component: RoomsPage,
});

function RoomsPage() {
  const navigate = useNavigate();
  const { session, loading, profile, signOut } = useAuth();
  const [rooms, setRooms] = useState<LocalRoom[]>([]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const sync = useCallback(() => {
    setRooms(listLocalRooms());
  }, []);

  useEffect(() => {
    sync();
    return subscribeLocalRooms(sync);
  }, [sync]);

  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-5 py-5 safe-t">
        <Link to="/" aria-label="Wynse home">
          <Wordmark />
        </Link>
        <Button asChild variant="secondary" size="sm">
          <Link to="/connect">New Room</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10">
        <h1 className="text-2xl">Rooms</h1>

        {rooms.length === 0 ? (
          <div className="panel mt-5 p-5">
            <p className="text-sm text-muted-foreground">
              No rooms yet. Share your Wynse ID to connect.
            </p>
            {profile ? (
              <p className="mt-4 font-display text-lg tracking-[0.18em]">{profile.stress_id}</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {rooms.map((room) => (
              <Link
                key={room.stressId}
                to="/room"
                search={{ id: room.stressId }}
                className="panel flex items-center justify-between p-4 transition-colors hover:bg-card/80"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-base tracking-[0.14em]">
                    {room.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{room.stressId}</p>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    room.synced
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {room.synced ? "Synced" : "Local"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
