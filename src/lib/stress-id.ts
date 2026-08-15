/** STRESS IDs: 12 unambiguous characters, grouped for reading aloud. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

export function generateStressId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

export function normalizeStressId(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return (cleaned.match(/.{1,4}/g) ?? []).join("-");
}

export const STRESS_ID_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidStressId(value: string): boolean {
  return STRESS_ID_PATTERN.test(value);
}

/** Payload encoded in the QR code. */
export function stressIdLink(stressId: string): string {
  const origin = typeof window === "undefined" ? "https://stress.app" : window.location.origin;
  return `${origin}/connect?id=${stressId}`;
}

export function stressIdFromScan(text: string): string | null {
  const direct = text.trim().toUpperCase();
  if (isValidStressId(direct)) return direct;
  try {
    const url = new URL(text);
    const id = url.searchParams.get("id")?.toUpperCase();
    if (id && isValidStressId(id)) return id;
  } catch {
    /* not a URL */
  }
  return null;
}
