/**
 * Realtime connection requests between two Wynse IDs.
 * Both sides watch the same row: the receiver accepts, the sender reacts.
 */
import { supabase } from "@/integrations/supabase/client";

export type RequestStatus = "pending" | "accepted" | "rejected";

export type ConnectionRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: RequestStatus;
  created_at: string;
};

const COLUMNS = "id, sender_id, receiver_id, status, created_at";

export async function sendConnectionRequest(
  senderId: string,
  receiverId: string,
): Promise<ConnectionRequest> {
  const { data, error } = await supabase
    .from("connection_requests")
    .insert({ sender_id: senderId, receiver_id: receiverId, status: "pending" })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as ConnectionRequest;
}

export async function fetchRequest(id: string): Promise<ConnectionRequest | null> {
  const { data, error } = await supabase
    .from("connection_requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRequest | null) ?? null;
}

export async function fetchIncomingRequests(receiverId: string): Promise<ConnectionRequest[]> {
  const { data, error } = await supabase
    .from("connection_requests")
    .select(COLUMNS)
    .eq("receiver_id", receiverId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConnectionRequest[];
}

export async function respondToConnectionRequest(id: string, accept: boolean) {
  const { error } = await supabase
    .from("connection_requests")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", id);
  if (error) throw error;
}

/** Realtime: new pending requests addressed to me. */
export function subscribeIncomingRequests(
  receiverId: string,
  onRequest: (request: ConnectionRequest) => void,
): () => void {
  const channel = supabase
    .channel(`connection-requests-in-${receiverId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "connection_requests",
        filter: `receiver_id=eq.${receiverId}`,
      },
      (payload) => {
        const row = payload.new as ConnectionRequest | null;
        if (row?.id && row.status === "pending") onRequest(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Realtime: status changes on requests I sent. */
export function subscribeOutgoingRequests(
  senderId: string,
  onUpdate: (request: ConnectionRequest) => void,
): () => void {
  const channel = supabase
    .channel(`connection-requests-out-${senderId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "connection_requests",
        filter: `sender_id=eq.${senderId}`,
      },
      (payload) => {
        const row = payload.new as ConnectionRequest | null;
        if (row?.id) onUpdate(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
