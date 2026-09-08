import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { CallModal } from "@/components/CallModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { recallMyStressId, roomIdFor } from "@/lib/cloud-rooms";
import { listLocalRooms, subscribeLocalRooms } from "@/lib/local-rooms";

/**
 * Listens for `call-invite` broadcasts across every room this user belongs to,
 * so an incoming call rings on the home screen or room list too.
 * Room IDs come from two sources, merged and de-duplicated:
 *  1. The backend: every cloud room where the user is a member.
 *  2. Local storage: rooms known on this device (offline fallback).
 * The room route handles its own signalling, so this stays out of the way there.
 */
export function GlobalCallListener() {
  const { session, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const myId = profile?.stress_id ?? recallMyStressId() ?? "";
  const inRoom = pathname.startsWith("/room");

  const sync = useCallback(async () => {
    const peers = new Set(listLocalRooms().map((room) => room.stressId));
    if (myId) {
      // Fetch every cloud room where I'm a member, then the other members.
      const { data: memberships } = await supabase
        .from("room_members")
        .select("room_id")
        .eq("stress_id", myId);
      const roomIds = (memberships ?? []).map((m) => m.room_id);
      if (roomIds.length > 0) {
        const { data: members } = await supabase
          .from("room_members")
          .select("stress_id")
          .in("room_id", roomIds)
          .neq("stress_id", myId);
        for (const member of members ?? []) peers.add(member.stress_id);
      }
    }
    setPeerIds([...peers].filter(Boolean));
  }, [myId]);

  useEffect(() => {
    void sync();
    const unsubscribe = subscribeLocalRooms(() => void sync());
    // Re-sync periodically so rooms created on another device are picked up.
    const interval = window.setInterval(() => void sync(), 30_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [sync]);

  useEffect(() => {
    if (!session || !myId || inRoom || activeRoomId || peerIds.length === 0) return;

    const channels = peerIds.map((peerId) => {
      const roomId = roomIdFor(myId, peerId);
      const channel = supabase.channel(`call-signal-${roomId}`, {
        config: { broadcast: { self: false } },
      });
      channel.on("broadcast", { event: "call-invite" }, ({ payload }) => {
        const sender = (payload as { sender?: string }).sender;
        if (sender && sender !== myId) setActiveRoomId(roomId);
      });
      void channel.subscribe();
      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [session, myId, inRoom, activeRoomId, peerIds]);

  if (!activeRoomId || !myId) return null;

  return (
    <CallModal
      isOpen
      roomId={activeRoomId}
      currentUserId={myId}
      initialState="incoming"
      onClose={() => setActiveRoomId(null)}
    />
  );
}
