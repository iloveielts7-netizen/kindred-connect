/**
 * Global listener: shows an "Incoming Connection Request" modal on the
 * receiver's device the moment someone sends them a request.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ensureCloudRoom, recallMyStressId } from "@/lib/cloud-rooms";
import {
  fetchIncomingRequests,
  respondToConnectionRequest,
  subscribeIncomingRequests,
  type ConnectionRequest,
} from "@/lib/connection-requests";
import { errorMessage, upsertLocalRoom } from "@/lib/local-rooms";

export function IncomingRequests() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [myId, setMyId] = useState<string | null>(null);
  const [queue, setQueue] = useState<ConnectionRequest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMyId(profile?.stress_id ?? recallMyStressId());
  }, [profile?.stress_id]);

  useEffect(() => {
    if (!myId) return;
    let active = true;

    void (async () => {
      try {
        const pending = await fetchIncomingRequests(myId);
        if (active && pending.length) setQueue(pending);
      } catch (error) {
        console.warn("incoming requests unavailable", errorMessage(error, "load failed"));
      }
    })();

    const unsubscribe = subscribeIncomingRequests(myId, (request) => {
      setQueue((prev) => (prev.some((r) => r.id === request.id) ? prev : [request, ...prev]));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [myId]);

  const current = queue[0];
  if (!current || !myId) return null;

  async function respond(accept: boolean) {
    if (!current || !myId) return;
    setBusy(true);
    try {
      await respondToConnectionRequest(current.id, accept);
      if (accept) {
        try {
          await ensureCloudRoom({ myId, peerId: current.sender_id });
        } catch (error) {
          console.warn("cloud room fallback", errorMessage(error));
        }
        upsertLocalRoom({ stressId: current.sender_id, synced: true });
        setQueue((prev) => prev.filter((r) => r.id !== current.id));
        void navigate({ to: "/room", search: { id: current.sender_id } });
        return;
      }
      toast("Request declined");
      setQueue((prev) => prev.filter((r) => r.id !== current.id));
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't update that request"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-sm">
      <div className="panel w-full max-w-sm p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          INCOMING CONNECTION REQUEST
        </p>
        <p className="mt-4 font-display text-xl tracking-[0.16em] text-foreground">
          {current.sender_id}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          wants to open a private room with you.
        </p>
        <div className="mt-6 flex gap-2">
          <Button
            variant="secondary"
            className="h-11 flex-1"
            disabled={busy}
            onClick={() => void respond(false)}
          >
            Decline
          </Button>
          <Button className="h-11 flex-1" disabled={busy} onClick={() => void respond(true)}>
            {busy ? "Working…" : "Accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
