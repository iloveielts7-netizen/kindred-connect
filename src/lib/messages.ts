import { supabase } from "@/integrations/supabase/client";
import {
  decryptWithContentKey,
  encryptWithContentKey,
  openSealedText,
  sealForPair,
  sodiumReady,
  unsealContentKey,
  type IdentityKeys,
} from "@/lib/crypto";
import { keySlot, type Connection } from "@/lib/rooms";

export type MessageKind = "text" | "image" | "video" | "file" | "voice";

export type MessageRow = {
  id: string;
  connection_id: string;
  sender_id: string;
  kind: MessageKind;
  cipher_body: string;
  cipher_nonce: string;
  cipher_key_a: string;
  cipher_key_b: string;
  media_path: string | null;
  media_meta: { file_nonce?: string } | null;
  reply_to: string | null;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  expires_at: string | null;
};

export type MediaInfo = { name: string; size: number; mime: string; duration?: number };

export type DecryptedMessage = MessageRow & {
  text: string | null;
  media: MediaInfo | null;
  failed: boolean;
};

function expiryFor(connection: Connection) {
  if (!connection.disappearing_seconds) return null;
  return new Date(Date.now() + connection.disappearing_seconds * 1000).toISOString();
}

function publicKeysFor(connection: Connection, mine: string, theirs: string, meId: string) {
  // cipher_key_a always belongs to connection.user_a.
  return connection.user_a === meId
    ? { a: mine, b: theirs }
    : { a: theirs, b: mine };
}

export async function sendTextMessage(input: {
  connection: Connection;
  meId: string;
  myPublicKey: string;
  theirPublicKey: string;
  text: string;
  replyTo?: string | null;
}) {
  const sodium = await sodiumReady();
  const keys = publicKeysFor(input.connection, input.myPublicKey, input.theirPublicKey, input.meId);
  const sealed = await sealForPair(sodium.from_string(input.text), keys.a, keys.b);
  const { data, error } = await supabase
    .from("messages")
    .insert({
      connection_id: input.connection.id,
      sender_id: input.meId,
      kind: "text",
      cipher_body: sealed.cipherBody,
      cipher_nonce: sealed.cipherNonce,
      cipher_key_a: sealed.cipherKeyA,
      cipher_key_b: sealed.cipherKeyB,
      reply_to: input.replyTo ?? null,
      expires_at: expiryFor(input.connection),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function editTextMessage(input: {
  message: MessageRow;
  connection: Connection;
  meId: string;
  myPublicKey: string;
  theirPublicKey: string;
  text: string;
}) {
  const sodium = await sodiumReady();
  const keys = publicKeysFor(input.connection, input.myPublicKey, input.theirPublicKey, input.meId);
  const sealed = await sealForPair(sodium.from_string(input.text), keys.a, keys.b);
  const { error } = await supabase
    .from("messages")
    .update({
      cipher_body: sealed.cipherBody,
      cipher_nonce: sealed.cipherNonce,
      cipher_key_a: sealed.cipherKeyA,
      cipher_key_b: sealed.cipherKeyB,
      edited_at: new Date().toISOString(),
    })
    .eq("id", input.message.id);
  if (error) throw error;
}

/** Encrypts the file in the browser, then uploads ciphertext to private storage. */
export async function sendMediaMessage(input: {
  connection: Connection;
  meId: string;
  myPublicKey: string;
  theirPublicKey: string;
  file: Blob;
  info: MediaInfo;
  kind: MessageKind;
}) {
  const sodium = await sodiumReady();
  const keys = publicKeysFor(input.connection, input.myPublicKey, input.theirPublicKey, input.meId);
  const sealed = await sealForPair(sodium.from_string(JSON.stringify(input.info)), keys.a, keys.b);
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const encrypted = await encryptWithContentKey(bytes, sealed.contentKey);
  const path = `${input.connection.id}/${crypto.randomUUID()}.bin`;

  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, new Blob([encrypted.cipher as BlobPart], { type: "application/octet-stream" }), {
      contentType: "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      connection_id: input.connection.id,
      sender_id: input.meId,
      kind: input.kind,
      cipher_body: sealed.cipherBody,
      cipher_nonce: sealed.cipherNonce,
      cipher_key_a: sealed.cipherKeyA,
      cipher_key_b: sealed.cipherKeyB,
      media_path: path,
      media_meta: { file_nonce: encrypted.nonce },
      expires_at: expiryFor(input.connection),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function decryptMessage(
  row: MessageRow,
  connection: Connection,
  meId: string,
  identity: IdentityKeys,
): Promise<DecryptedMessage> {
  const sealedKey = row[keySlot(connection, meId)];
  if (row.deleted_at) {
    return { ...row, text: null, media: null, failed: false };
  }
  try {
    const plain = await openSealedText(
      { cipherBody: row.cipher_body, cipherNonce: row.cipher_nonce, sealedKey },
      identity,
    );
    if (row.kind === "text") return { ...row, text: plain, media: null, failed: false };
    return { ...row, text: null, media: JSON.parse(plain) as MediaInfo, failed: false };
  } catch {
    return { ...row, text: null, media: null, failed: true };
  }
}

/** Downloads the ciphertext and decrypts it locally into an object URL. */
export async function openMedia(
  row: MessageRow,
  connection: Connection,
  meId: string,
  identity: IdentityKeys,
  info: MediaInfo,
): Promise<string> {
  if (!row.media_path || !row.media_meta?.file_nonce) throw new Error("Missing media");
  const { data, error } = await supabase.storage.from("media").download(row.media_path);
  if (error) throw error;
  const contentKey = await unsealContentKey(row[keySlot(connection, meId)], identity);
  const plain = await decryptWithContentKey(
    new Uint8Array(await data.arrayBuffer()),
    row.media_meta.file_nonce,
    contentKey,
  );
  return URL.createObjectURL(new Blob([plain as BlobPart], { type: info.mime }));
}

export async function fetchMessages(connectionId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as MessageRow[]).filter(
    (row) => !row.expires_at || new Date(row.expires_at).getTime() > now,
  );
}

export async function markDelivered(ids: string[]) {
  if (!ids.length) return;
  await supabase
    .from("messages")
    .update({ delivered_at: new Date().toISOString() })
    .in("id", ids)
    .is("delivered_at", null);
}

export async function markRead(ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  await supabase
    .from("messages")
    .update({ delivered_at: now, read_at: now })
    .in("id", ids)
    .is("read_at", null);
}

/** Deletes for both sides: removes content, keeps a tombstone row. */
export async function deleteMessage(row: MessageRow) {
  if (row.media_path) {
    await supabase.storage.from("media").remove([row.media_path]);
  }
  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      cipher_body: "",
      cipher_nonce: "",
      cipher_key_a: "",
      cipher_key_b: "",
      media_path: null,
      media_meta: null,
    })
    .eq("id", row.id);
  if (error) throw error;
}

/** Sweeps expired disappearing messages from this room. */
export async function purgeExpired(connectionId: string) {
  const { data } = await supabase
    .from("messages")
    .select("id, media_path")
    .eq("connection_id", connectionId)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString());
  const rows = data ?? [];
  if (!rows.length) return;
  const paths = rows.map((r) => r.media_path).filter((p): p is string => Boolean(p));
  if (paths.length) await supabase.storage.from("media").remove(paths);
  await supabase
    .from("messages")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    );
}
