import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchRoomActivity,
  recallMyStressId,
  subscribeRoomActivity,
  type RoomActivity,
} from "@/lib/cloud-rooms";
import { formatTime } from "@/lib/format";
import { errorMessage, listLocalRooms, subscribeLocalRooms, type LocalRoom } from "@/lib/local-rooms";

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
  const [activity, setActivity] = useState<Record<string, RoomActivity>>({});

  const myId = profile?.stress_id ?? recallMyStressId() ?? "";

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

  const refreshActivity = useCallback(() => {
    if (!myId || rooms.length === 0) return;
    void (async () => {
      try {
        setActivity(await fetchRoomActivity(myId, rooms.map((room) => room.stressId)));
      } catch (error) {
        console.warn("unread counts unavailable", errorMessage(error, "load failed"));
      }
    })();
  }, [myId, rooms]);

  useEffect(() => {
    refreshActivity();
  }, [refreshActivity]);

  useEffect(() => {
    if (!myId) return;
    return subscribeRoomActivity(myId, refreshActivity);
  }, [myId, refreshActivity]);


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
            {rooms.map((room) => {
              const unread = activity[room.stressId]?.unread ?? 0;
              const lastAt = activity[room.stressId]?.lastAt ?? room.createdAt;
              return (
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
                  <div className="ml-3 flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`text-[11px] ${
                        unread > 0 ? "font-semibold text-[#00f2ff]" : "text-muted-foreground"
                      }`}
                    >
                      {lastAt ? formatTime(lastAt) : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      {unread > 0 ? (
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00f2ff] text-[10px] font-bold text-[#090e13] shadow-[0_0_8px_rgba(0,242,255,0.45)]"
                          aria-label={`${unread} unread`}
                        >
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          room.synced
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {room.synced ? "Synced" : "Local"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
