import { useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { CallModal } from "@/components/CallModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { recallMyStressId, roomIdFor } from "@/lib/cloud-rooms";
import { listLocalRooms, subscribeLocalRooms } from "@/lib/local-rooms";

/**
 * Listens for `call-invite` broadcasts across every room this device knows
 * about, so an incoming call rings on the home screen or room list too.
 * The room route handles its own signalling, so this stays out of the way there.
 */
export function GlobalCallListener() {
  const { session, profile } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  const myId = profile?.stress_id ?? recallMyStressId() ?? "";
  const inRoom = pathname.startsWith("/room");

  const sync = useCallback(() => {
    setPeerIds(listLocalRooms().map((room) => room.stressId));
  }, []);

  useEffect(() => {
    sync();
    return subscribeLocalRooms(sync);
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
