import { createHash, timingSafeEqual } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Normalize invite code for hashing (strip dashes/spaces, uppercase). */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function hashInviteCode(normalizedCode: string): string {
  return createHash("sha256").update(normalizedCode, "utf8").digest("hex");
}

/** Constant-time compare of stored hash vs candidate code. */
export function inviteCodeMatches(
  storedHash: string,
  rawCode: string,
): boolean {
  const candidate = hashInviteCode(normalizeInviteCode(rawCode));
  try {
    const a = Buffer.from(storedHash, "hex");
    const b = Buffer.from(candidate, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Generate XXXX-XXXX display code (8 chars from alphabet). */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (let i = 0; i < 8; i++) {
    raw += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
