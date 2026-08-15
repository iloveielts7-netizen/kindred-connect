/**
 * STRESS end-to-end encryption.
 *
 * Nothing here is home-made: every primitive comes from libsodium
 * (libsodium-wrappers-sumo), a widely reviewed implementation of NaCl.
 *
 *  - Identity: X25519 key pair per device (crypto_box_keypair).
 *  - Per message: random 32-byte content key, XSalsa20-Poly1305
 *    (crypto_secretbox_easy) over the payload.
 *  - Content key delivery: crypto_box_seal (anonymous sealed box) to each
 *    participant's public key, so both sides — and only they — can open it.
 *
 * The private key is generated in the browser and stored only in this
 * device's localStorage. It is never sent to the server.
 */
import _sodium from "libsodium-wrappers-sumo";

type Sodium = typeof _sodium;

let ready: Promise<Sodium> | null = null;

export function sodiumReady(): Promise<Sodium> {
  if (!ready) {
    ready = _sodium.ready.then(() => _sodium);
  }
  return ready;
}

export type IdentityKeys = { publicKey: string; secretKey: string };

const storageKey = (userId: string) => `stress.identity.v1.${userId}`;

export async function loadIdentity(userId: string): Promise<IdentityKeys | null> {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as IdentityKeys;
    if (parsed.publicKey && parsed.secretKey) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function createIdentity(userId: string): Promise<IdentityKeys> {
  const sodium = await sodiumReady();
  const pair = sodium.crypto_box_keypair();
  const keys: IdentityKeys = {
    publicKey: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL),
    secretKey: sodium.to_base64(pair.privateKey, sodium.base64_variants.ORIGINAL),
  };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(keys));
  return keys;
}

export async function ensureIdentity(userId: string): Promise<IdentityKeys> {
  return (await loadIdentity(userId)) ?? (await createIdentity(userId));
}

export function forgetIdentity(userId: string) {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(userId));
}

async function b64(input: Uint8Array) {
  const sodium = await sodiumReady();
  return sodium.to_base64(input, sodium.base64_variants.ORIGINAL);
}

async function unb64(input: string) {
  const sodium = await sodiumReady();
  return sodium.from_base64(input, sodium.base64_variants.ORIGINAL);
}

export type SealedPayload = {
  cipherBody: string;
  cipherNonce: string;
  /** sealed content key for the first participant */
  cipherKeyA: string;
  /** sealed content key for the second participant */
  cipherKeyB: string;
};

/** Encrypt bytes for exactly two public keys. */
export async function sealForPair(
  payload: Uint8Array,
  publicKeyA: string,
  publicKeyB: string,
): Promise<SealedPayload> {
  const sodium = await sodiumReady();
  const contentKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const body = sodium.crypto_secretbox_easy(payload, nonce, contentKey);
  return {
    cipherBody: await b64(body),
    cipherNonce: await b64(nonce),
    cipherKeyA: await b64(sodium.crypto_box_seal(contentKey, await unb64(publicKeyA))),
    cipherKeyB: await b64(sodium.crypto_box_seal(contentKey, await unb64(publicKeyB))),
  };
}

export async function sealTextForPair(text: string, publicKeyA: string, publicKeyB: string) {
  const sodium = await sodiumReady();
  return sealForPair(sodium.from_string(text), publicKeyA, publicKeyB);
}

/** Open a sealed content key with this device's identity. */
async function openContentKey(sealedKey: string, identity: IdentityKeys) {
  const sodium = await sodiumReady();
  return sodium.crypto_box_seal_open(
    await unb64(sealedKey),
    await unb64(identity.publicKey),
    await unb64(identity.secretKey),
  );
}

export async function openSealed(
  sealed: { cipherBody: string; cipherNonce: string; sealedKey: string },
  identity: IdentityKeys,
): Promise<Uint8Array> {
  const sodium = await sodiumReady();
  const contentKey = await openContentKey(sealed.sealedKey, identity);
  return sodium.crypto_secretbox_open_easy(
    await unb64(sealed.cipherBody),
    await unb64(sealed.cipherNonce),
    contentKey,
  );
}

export async function openSealedText(
  sealed: { cipherBody: string; cipherNonce: string; sealedKey: string },
  identity: IdentityKeys,
): Promise<string> {
  const sodium = await sodiumReady();
  return sodium.to_string(await openSealed(sealed, identity));
}

/**
 * Short human-comparable safety code for the two public keys in a room.
 * Both sides compute the same code; comparing it out-of-band detects a
 * man-in-the-middle key swap.
 */
export async function safetyCode(publicKeyA: string, publicKeyB: string): Promise<string> {
  const sodium = await sodiumReady();
  const ordered = [publicKeyA, publicKeyB].sort().join("|");
  const digest = sodium.crypto_generichash(30, sodium.from_string(ordered), null, "uint8array");
  const digits = Array.from(digest as Uint8Array)
    .map((byte) => (byte % 10).toString())
    .join("");
  return (digits.match(/.{1,5}/g) ?? []).slice(0, 6).join(" ");
}
