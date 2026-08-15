import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/hooks/useAuth";

export type Connection = {
  id: string;
  user_a: string;
  user_b: string;
  requester_id: string;
  status: "pending" | "accepted" | "declined";
  disappearing_seconds: number;
  created_at: string;
  accepted_at: string | null;
};

export type Room = {
  connection: Connection;
  other: Pick<Profile, "id" | "display_name" | "stress_id" | "public_key" | "last_seen_at">;
  isRequester: boolean;
};

export function pairKey(a: string, b: string) {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export function otherId(connection: Connection, me: string) {
  return connection.user_a === me ? connection.user_b : connection.user_a;
}

/** Which sealed-key column belongs to a given participant. */
export function keySlot(connection: Connection, userId: string): "cipher_key_a" | "cipher_key_b" {
  return connection.user_a === userId ? "cipher_key_a" : "cipher_key_b";
}

export async function fetchRooms(me: string): Promise<Room[]> {
  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const list = (connections ?? []) as Connection[];
  const others = list.map((c) => otherId(c, me));
  if (!others.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, stress_id, public_key, last_seen_at")
    .in("id", others);
  if (profileError) throw profileError;

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return list
    .map((connection) => {
      const other = byId.get(otherId(connection, me));
      if (!other) return null;
      return {
        connection,
        other: other as Room["other"],
        isRequester: connection.requester_id === me,
      } satisfies Room;
    })
    .filter((room): room is Room => room !== null);
}

export async function fetchRoom(me: string, connectionId: string): Promise<Room | null> {
  const { data: connection, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) throw error;
  if (!connection) return null;
  const { data: other } = await supabase
    .from("profiles")
    .select("id, display_name, stress_id, public_key, last_seen_at")
    .eq("id", otherId(connection as Connection, me))
    .maybeSingle();
  if (!other) return null;
  return {
    connection: connection as Connection,
    other: other as Room["other"],
    isRequester: connection.requester_id === me,
  };
}

export async function findByStressId(stressId: string) {
  const { data, error } = await supabase.rpc("find_by_stress_id", { _stress_id: stressId });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    stress_id: string;
    display_name: string;
    public_key: string | null;
  }>;
  return rows[0] ?? null;
}

export async function requestConnection(me: string, otherUserId: string) {
  const pair = pairKey(me, otherUserId);
  const { data, error } = await supabase
    .from("connections")
    .insert({ ...pair, requester_id: me, status: "pending" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Connection;
}

export async function respondToRequest(connectionId: string, accept: boolean) {
  const { error } = await supabase
    .from("connections")
    .update(
      accept
        ? { status: "accepted", accepted_at: new Date().toISOString() }
        : { status: "declined" },
    )
    .eq("id", connectionId);
  if (error) throw error;
}

export async function setDisappearing(connectionId: string, seconds: number) {
  const { error } = await supabase
    .from("connections")
    .update({ disappearing_seconds: seconds })
    .eq("id", connectionId);
  if (error) throw error;
}

export async function blockUser(me: string, otherUserId: string) {
  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: me, blocked_id: otherUserId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}

export async function unblockUser(me: string, otherUserId: string) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", me)
    .eq("blocked_id", otherUserId);
  if (error) throw error;
}

export async function fetchBlocks(me: string) {
  const { data, error } = await supabase
    .from("blocks")
    .select("id, blocked_id, created_at")
    .eq("blocker_id", me);
  if (error) throw error;
  return data ?? [];
}

export async function submitReport(input: {
  reporterId: string;
  reportedId: string;
  reason: string;
  details?: string;
  excerpt?: string;
}) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: input.reporterId,
    reported_id: input.reportedId,
    reason: input.reason,
    details: input.details ?? null,
    submitted_excerpt: input.excerpt ?? null,
  });
  if (error) throw error;
}

export function isOnline(lastSeenAt: string) {
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}
