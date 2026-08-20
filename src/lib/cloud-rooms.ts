/**
 * Cloud room sync. Two people who connect always derive the SAME canonical room
 * id from their two Wynse IDs, so both devices join the exact same cloud room
 * and messages flow in real time.
 */
import { supabase } from "@/integrations/supabase/client";

export type CloudMessage = {
  id: string;
  room_id: string;
  sender_stress_id: string;
  body: string;
  created_at: string;
};

const MY_ID_KEY = "wynse.my.id";

export function roomIdFor(idA: string, idB: string): string {
  return [idA, idB].sort().join("-");
}

export function rememberMyStressId(stressId: string) {
  if (typeof window === "undefined" || !stressId) return;
  try {
    window.localStorage.setItem(MY_ID_KEY, stressId);
  } catch {
    /* ignore */
  }
}

export function recallMyStressId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(MY_ID_KEY);
  } catch {
    return null;
  }
}

/** Creates (or joins) the canonical cloud room for a pair of Wynse IDs. */
export async function ensureCloudRoom(input: {
  myId: string;
  peerId: string;
  myName?: string;
  peerName?: string;
}): Promise<string> {
  const [a, b] = [input.myId, input.peerId].sort();
  const roomId = roomIdFor(input.myId, input.peerId);

  const { error: roomError } = await supabase
    .from("rooms")
    .upsert({ id: roomId, stress_id_a: a!, stress_id_b: b! }, { onConflict: "id" });
  if (roomError) throw roomError;

  const members = [
    { room_id: roomId, stress_id: input.myId, display_name: input.myName || input.myId },
    { room_id: roomId, stress_id: input.peerId, display_name: input.peerName || input.peerId },
  ];
  const { error: memberError } = await supabase
    .from("room_members")
    .upsert(members, { onConflict: "room_id,stress_id" });
  if (memberError) throw memberError;

  return roomId;
}

export async function fetchCloudMessages(roomId: string): Promise<CloudMessage[]> {
  const { data, error } = await supabase
    .from("room_messages")
    .select("id, room_id, sender_stress_id, body, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CloudMessage[];
}

export async function sendCloudMessage(input: {
  roomId: string;
  senderStressId: string;
  body: string;
}): Promise<CloudMessage> {
  const { data, error } = await supabase
    .from("room_messages")
    .insert({
      room_id: input.roomId,
      sender_stress_id: input.senderStressId,
      body: input.body,
    })
    .select("id, room_id, sender_stress_id, body, created_at")
    .single();
  if (error) throw error;
  return data as CloudMessage;
}

/** Realtime subscription to new/updated messages in one room. */
export function subscribeCloudMessages(
  roomId: string,
  onChange: (message: CloudMessage) => void,
): () => void {
  const channel = supabase
    .channel(`room-messages-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "room_messages",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        const row = payload.new as CloudMessage | null;
        if (row?.id) onChange(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
