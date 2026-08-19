/**
 * Local-first room store. Used as a resilient fallback so two people who have
 * each other's Wynse ID can always open a room and exchange messages in the UI,
 * even when the backend rejects the request (permissions, offline, etc.).
 */

const ROOMS_KEY = "wynse.local.rooms";
const MSG_PREFIX = "wynse.local.messages.";
export const LOCAL_ROOMS_EVENT = "wynse:local-rooms";

export type LocalRoom = {
  /** Wynse ID of the other person (also the room key). */
  stressId: string;
  displayName: string;
  createdAt: string;
  /** True when the backend connection request succeeded. */
  synced: boolean;
};

export type LocalMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(LOCAL_ROOMS_EVENT));
  } catch {
    /* storage full or unavailable */
  }
}

export function listLocalRooms(): LocalRoom[] {
  return safeRead<LocalRoom[]>(ROOMS_KEY, []);
}

export function getLocalRoom(stressId: string): LocalRoom | null {
  return listLocalRooms().find((room) => room.stressId === stressId) ?? null;
}

export function upsertLocalRoom(input: {
  stressId: string;
  displayName?: string;
  synced?: boolean;
}): LocalRoom {
  const rooms = listLocalRooms();
  const existing = rooms.find((room) => room.stressId === input.stressId);
  const room: LocalRoom = {
    stressId: input.stressId,
    displayName: input.displayName ?? existing?.displayName ?? input.stressId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    synced: input.synced ?? existing?.synced ?? false,
  };
  const next = [room, ...rooms.filter((r) => r.stressId !== input.stressId)];
  safeWrite(ROOMS_KEY, next);
  return room;
}

export function removeLocalRoom(stressId: string) {
  safeWrite(
    ROOMS_KEY,
    listLocalRooms().filter((room) => room.stressId !== stressId),
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(MSG_PREFIX + stressId);
    } catch {
      /* ignore */
    }
  }
}

export function listLocalMessages(stressId: string): LocalMessage[] {
  return safeRead<LocalMessage[]>(MSG_PREFIX + stressId, []);
}

export function appendLocalMessage(stressId: string, body: string, mine = true): LocalMessage {
  const message: LocalMessage = {
    id: crypto.randomUUID(),
    body,
    mine,
    createdAt: new Date().toISOString(),
  };
  safeWrite(MSG_PREFIX + stressId, [...listLocalMessages(stressId), message]);
  return message;
}

/** Subscribes to local room/message changes in this tab and other tabs. */
export function subscribeLocalRooms(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOCAL_ROOMS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(LOCAL_ROOMS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Human-readable error text for any thrown value. */
export function errorMessage(error: unknown, fallback = "Failed to send request"): string {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;
  if (error instanceof Error) return error.message || fallback;
  const obj = error as { message?: unknown; details?: unknown; hint?: unknown };
  for (const value of [obj.message, obj.details, obj.hint]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
