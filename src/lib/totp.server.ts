// RFC 6238 TOTP (SHA-1, 30s, 6 digits) — pure Node crypto, no deps.
// Server-only. Never import from client code.

import { createHmac, randomBytes, createHash } from "crypto";

const PERIOD = 30;
const DIGITS = 6;

// ---- base32 (RFC 4648, upper-case, no padding for keys) ----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  // 20 bytes = 160 bits (SHA-1 native), encodes to 32 base32 chars
  return base32Encode(randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / PERIOD);
}

/** Verify with ±1 step tolerance. Returns the matched step or null. */
export function verifyTotp(secretB32: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  if (secret.length === 0) return null;
  const step = currentStep(now);
  for (const delta of [0, -1, 1]) {
    if (hotp(secret, step + delta) === code) return step + delta;
  }
  return null;
}

export function otpauthURL(secret: string, account: string, issuer = "EscrowDesk"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---- Recovery codes ----
// 8 codes of format XXXX-XXXX (Crockford-ish: A-Z 2-9, no I/L/O/0/1)
const RC_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRecoveryCodes(n = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = randomBytes(8);
    let s = "";
    for (let j = 0; j < 8; j++) s += RC_ALPHABET[r[j] % RC_ALPHABET.length];
    codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function isRecoveryCodeFormat(s: string): boolean {
  return /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(s.trim());
}
