// Telegram inline-keyboard helpers + signed callback data.
//
// Callback payload format:  v2|<action>|<short>|<ts36>|<sig>
//   action  — paid|release|confirm|dispute|reply|approve|reject|resolve_b|resolve_s|case|wd_cancel
//   short   — entity short id (first 8 hex of uuid, or other compact ref)
//   ts36    — unix seconds (base36) when the button was minted
//   sig     — first 8 chars of base64url(hmac_sha256(TELEGRAM_API_KEY, action|short|tgUserId|ts36))
//
// Binding to `tgUserId` prevents a forwarded message's buttons from being
// pressed by another user. The timestamp + MAX_AGE_SEC bound limits replay
// to a fixed window even if old chat history is later exposed. Telegram
// caps callback_data at 64 bytes — this format fits comfortably under that.

import { createHmac } from "crypto";
import { APP_URL } from "@/lib/app-config";

const SIG_LEN = 8;
// Buttons expire 24h after being minted.
const MAX_AGE_SEC = 24 * 60 * 60;

function key() {
  return process.env.TELEGRAM_API_KEY || "";
}

function mac(action: string, short: string, tgUserId: number | string, ts36: string): string {
  return createHmac("sha256", key())
    .update(`${action}|${short}|${tgUserId}|${ts36}`)
    .digest("base64url")
    .slice(0, SIG_LEN);
}

export function signCb(action: string, short: string, tgUserId: number | string): string {
  const ts36 = Math.floor(Date.now() / 1000).toString(36);
  return `v2|${action}|${short}|${ts36}|${mac(action, short, tgUserId, ts36)}`;
}

export function verifyCb(
  data: string,
  tgUserId: number | string,
): { action: string; short: string } | { expired: true } | null {
  const parts = data.split("|");
  // Reject v1 (no timestamp). Only v2 is accepted.
  if (parts.length !== 5 || parts[0] !== "v2") return null;
  const [, action, short, ts36, sig] = parts;
  const ts = parseInt(ts36, 36);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const expected = mac(action, short, tgUserId, ts36);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  if (Math.floor(Date.now() / 1000) - ts > MAX_AGE_SEC) return { expired: true };
  return { action, short };
}

type Btn = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: Btn[][] };

/** Build the action keyboard shown under a trade notification. */
export function tradeActionKeyboard(opts: {
  tradeId: string;
  tgUserId: number | string;
  role: "buyer" | "seller" | "other";
  status: string;
}): Keyboard | undefined {
  const short = opts.tradeId.slice(0, 8);
  const row: Btn[] = [];
  const sign = (a: string) => signCb(a, short, opts.tgUserId);

  if (opts.role === "buyer" && opts.status === "pending_payment") {
    row.push({ text: "✅ I've paid", callback_data: sign("paid") });
  }
  if (opts.role === "seller" && opts.status === "awaiting_seller_confirm") {
    row.push({ text: "✅ Confirm deposit", callback_data: sign("confirm") });
  }
  if (opts.role === "seller" && opts.status === "paid") {
    row.push({ text: "🎉 Release", callback_data: sign("release") });
  }
  if (
    opts.role !== "other" &&
    ["pending_payment", "paid", "awaiting_seller_confirm"].includes(opts.status)
  ) {
    row.push({ text: "🚩 Dispute", callback_data: sign("dispute") });
  }
  // Always offer Reply when the user is a party.
  if (opts.role !== "other") {
    row.push({ text: "💬 Reply", callback_data: sign("reply") });
  }
  if (row.length === 0) return undefined;
  const second: Btn[] = [
    { text: "🔗 Open on web", url: `${APP_URL}/trades/${opts.tradeId}` },
  ];
  return { inline_keyboard: [row, second] };
}

/** Force-reply marker so the user's next message is treated as a TOTP. */
export const forceReply = {
  force_reply: true as const,
  input_field_placeholder: "6-digit code (or chat message)",
  selective: true as const,
};
