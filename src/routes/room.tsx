import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  ensureCloudRoom,
  fetchCloudMessages,
  recallMyStressId,
  roomIdFor,
  sendCloudMessage,
  subscribeCloudMessages,
  type CloudMessage,
} from "@/lib/cloud-rooms";
import {
  appendLocalMessage,
  errorMessage,
  getLocalRoom,
  listLocalMessages,
  subscribeLocalRooms,
  upsertLocalRoom,
  type LocalMessage,
} from "@/lib/local-rooms";
import { normalizeStressId } from "@/lib/stress-id";

const searchSchema = z.object({ id: z.string().catch("") });

export const Route = createFileRoute("/room")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Private room — Wynse" },
      {
        name: "description",
        content: "A private room for two. Messages stay strictly between you and your recipient.",
      },
      { property: "og:title", content: "Private room — Wynse" },
      { property: "og:description", content: "One room, two people, Safe Exchange." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const { session, loading, profile } = useAuth();
  const search = Route.useSearch();
  const peerId = normalizeStressId(search.id ?? "");

  const myId = profile?.stress_id ?? recallMyStressId() ?? "";
  const roomId = useMemo(() => (myId && peerId ? roomIdFor(myId, peerId) : ""), [myId, peerId]);

  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [cloudMessages, setCloudMessages] = useState<CloudMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const synced = cloudMessages !== null;

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", search: { mode: "signup" } });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!peerId) {
      void navigate({ to: "/connect" });
      return;
    }
    if (!getLocalRoom(peerId)) upsertLocalRoom({ stressId: peerId });
  }, [peerId, navigate]);

  const syncLocal = useCallback(() => {
    if (peerId) setLocalMessages(listLocalMessages(peerId));
  }, [peerId]);

  useEffect(() => {
    syncLocal();
    return subscribeLocalRooms(syncLocal);
  }, [syncLocal]);

  // Cloud room + realtime subscription.
  useEffect(() => {
    if (!roomId || !myId || !peerId) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await ensureCloudRoom({
          myId,
          peerId,
          myName: profile?.display_name ?? myId,
          peerName: getLocalRoom(peerId)?.displayName,
        });
        const existing = await fetchCloudMessages(roomId);
        if (!active) return;
        setCloudMessages(existing);
        upsertLocalRoom({ stressId: peerId, synced: true });

        unsubscribe = subscribeCloudMessages(roomId, (message) => {
          setCloudMessages((current) => {
            const list = current ?? [];
            if (list.some((m) => m.id === message.id)) return list;
            return [...list, message];
          });
        });
      } catch (error) {
        console.warn("cloud room unavailable, staying local", errorMessage(error, "sync failed"));
        if (active) setCloudMessages(null);
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [roomId, myId, peerId, profile?.display_name]);

  const messages = useMemo(() => {
    if (cloudMessages) {
      return cloudMessages.map((message) => ({
        id: message.id,
        body: message.body,
        mine: message.sender_stress_id === myId,
      }));
    }
    return localMessages.map((message) => ({
      id: message.id,
      body: message.body,
      mine: message.mine,
    }));
  }, [cloudMessages, localMessages, myId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !peerId) return;
    setDraft("");

    if (roomId && synced && myId) {
      try {
        const message = await sendCloudMessage({ roomId, senderStressId: myId, body });
        setCloudMessages((current) => {
          const list = current ?? [];
          return list.some((m) => m.id === message.id) ? list : [...list, message];
        });
        return;
      } catch (error) {
        console.warn("cloud send failed, storing locally", errorMessage(error, "send failed"));
        setCloudMessages(null);
      }
    }
    appendLocalMessage(peerId, body, true);
  }

  return (
    <div className="flex min-h-screen flex-col room-glow">
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-5 py-4 safe-t">
        <Button asChild variant="ghost" size="icon" aria-label="Back to rooms">
          <Link to="/rooms">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base tracking-[0.14em]">{peerId}</p>
          <p className="text-xs text-muted-foreground">Private room · Safe Exchange</p>
        </div>
        <span
          className={
            synced
              ? "rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary"
              : "rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          }
        >
          {synced ? "Synced" : "Local"}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
        <div className="flex-1 space-y-3 py-4">
          {messages.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              This room is ready. Messages you send here stay strictly between you and{" "}
              <span className="text-foreground">{peerId}</span>.
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.mine
                    ? "ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "mr-auto max-w-[80%] rounded-2xl bg-card px-4 py-2.5 text-sm text-foreground"
                }
              >
                {message.body}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-0 flex gap-2 bg-background/80 py-4 backdrop-blur"
          onSubmit={(event) => void send(event)}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message…"
            className="h-12"
            autoComplete="off"
          />
          <Button type="submit" size="icon" className="size-12" aria-label="Send message">
            <Send className="size-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
