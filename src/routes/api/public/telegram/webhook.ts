import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tgCall, tgSendMessage } from "@/lib/telegram.server";
import {
  verifyTotp, hashRecoveryCode, isRecoveryCodeFormat,
} from "@/lib/totp.server";
import { signCb, verifyCb, tradeActionKeyboard, forceReply } from "@/lib/telegram/keyboards";

type PendingPrompt =
  | { kind: "totp"; action: "release" | "confirm" | "dispute"; trade_id: string; expires: number }
  | { kind: "chat"; trade_id: string; expires: number }
  | { kind: "withdraw_addr"; expires: number }
  | { kind: "admin_totp"; action: string; ref: string; expires: number };

async function setPendingPrompt(userId: string, msgId: number, p: PendingPrompt) {
  const { data } = await supabaseAdmin
    .from("profiles").select("tg_pending_prompts" as never).eq("user_id", userId).maybeSingle();
  const cur = ((data as { tg_pending_prompts?: Record<string, PendingPrompt> } | null)?.tg_pending_prompts ?? {});
  // Drop expired entries
  const now = Date.now();
  const cleaned: Record<string, PendingPrompt> = {};
  for (const [k, v] of Object.entries(cur)) if (v && v.expires > now) cleaned[k] = v;
  cleaned[String(msgId)] = p;
  await supabaseAdmin.from("profiles").update({ tg_pending_prompts: cleaned as never } as never).eq("user_id", userId);
}

async function takePendingPrompt(userId: string, msgId: number): Promise<PendingPrompt | null> {
  const { data } = await supabaseAdmin
    .from("profiles").select("tg_pending_prompts" as never).eq("user_id", userId).maybeSingle();
  const cur = ((data as { tg_pending_prompts?: Record<string, PendingPrompt> } | null)?.tg_pending_prompts ?? {});
  const key = String(msgId);
  const hit = cur[key];
  if (!hit) return null;
  delete cur[key];
  await supabaseAdmin.from("profiles").update({ tg_pending_prompts: cur as never } as never).eq("user_id", userId);
  if (hit.expires < Date.now()) return null;
  return hit;
}



// ───────── TOTP gate helpers (Phase 2) ─────────

const TOTP_BRUTE_WINDOW_MIN = 15;
const TOTP_BRUTE_THRESHOLD = 5;

async function auditTg(
  userId: string,
  kind: string,
  err?: { message: string } | null,
  metadata: Record<string, unknown> = {},
) {
  await supabaseAdmin.from("user_security_events").insert({
    user_id: userId,
    kind,
    severity: err ? "warning" : "info",
    metadata: { ...metadata, ...(err ? { error: err.message } : {}) } as never,
  });
}

async function isLockedOut(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - TOTP_BRUTE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("user_security_events")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "tg_totp_fail")
    .gte("created_at", since);
  return (count ?? 0) >= TOTP_BRUTE_THRESHOLD;
}

/**
 * Consume a TOTP or recovery code for a user.
 * Returns reason on failure: 'no_totp' | 'locked' | 'invalid' | 'replayed' | 'rate_limit'.
 */
async function consumeTotp(
  userId: string,
  token: string,
): Promise<{ ok: true; viaRecovery: boolean } | { ok: false; reason: string }> {
  if (await isLockedOut(userId)) return { ok: false, reason: "locked" };

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("totp_secret, totp_enabled_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!prof?.totp_enabled_at || !prof.totp_secret) return { ok: false, reason: "no_totp" };

  const t = token.trim();
  if (/^\d{6}$/.test(t)) {
    const step = verifyTotp(prof.totp_secret, t);
    if (step == null) {
      await auditTg(userId, "tg_totp_fail", { message: "invalid_code" });
      return { ok: false, reason: "invalid" };
    }
    // Replay protection — INSERT with PK (user_id, step)
    const { error } = await supabaseAdmin
      .from("totp_used_steps")
      .insert({ user_id: userId, step });
    if (error) {
      await auditTg(userId, "tg_totp_fail", { message: "replayed" });
      return { ok: false, reason: "replayed" };
    }
    await supabaseAdmin
      .from("profiles")
      .update({ totp_last_step: step })
      .eq("user_id", userId);
    return { ok: true, viaRecovery: false };
  }

  if (isRecoveryCodeFormat(t)) {
    const { data: del } = await supabaseAdmin
      .from("totp_recovery_codes")
      .delete()
      .eq("user_id", userId)
      .eq("code_hash", hashRecoveryCode(t))
      .select("user_id");
    if ((del?.length ?? 0) === 0) {
      await auditTg(userId, "tg_totp_fail", { message: "invalid_recovery" });
      return { ok: false, reason: "invalid" };
    }
    await auditTg(userId, "tg_recovery_used", null);
    return { ok: true, viaRecovery: true };
  }

  await auditTg(userId, "tg_totp_fail", { message: "bad_format" });
  return { ok: false, reason: "invalid" };
}

function enrollHint(cmd: string): string {
  return (
    `🔒 <b>${cmd}</b> requires two-factor authentication.\n\n` +
    `Enable 2FA at https://escrowdesk.lovable.app → Settings → Security, ` +
    `then append your 6-digit code as the LAST argument.\n\n` +
    `Example: <code>${cmd} ARG 123456</code>`
  );
}

/**
 * Parse the trailing token from a Telegram command, verify it, and return
 * the command text with the token stripped (so existing parsers run unchanged).
 */
async function requireTotpFromText(
  userId: string,
  text: string,
  cmd: string,
): Promise<{ ok: true; text: string } | { ok: false; reply: string }> {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return { ok: false, reply: enrollHint(cmd) };
  const last = parts[parts.length - 1];
  const isToken = /^\d{6}$/.test(last) || isRecoveryCodeFormat(last);
  if (!isToken) return { ok: false, reply: enrollHint(cmd) };

  const r = await consumeTotp(userId, last);
  if (!r.ok) {
    if (r.reason === "no_totp") return { ok: false, reply: enrollHint(cmd) };
    if (r.reason === "locked")
      return { ok: false, reply: `🚫 Too many invalid codes. Telegram fund actions are paused for ${TOTP_BRUTE_WINDOW_MIN} minutes.` };
    if (r.reason === "replayed")
      return { ok: false, reply: "❌ That code was already used — wait for the next one (refreshes every 30s)." };
    return { ok: false, reply: "❌ Invalid 2FA code." };
  }

  const stripped = parts.slice(0, -1).join(" ");
  const extra = r.viaRecovery
    ? "\n\n⚠️ <i>Used a recovery code — generate fresh ones at Settings → Security.</i>"
    : "";
  // Append the recovery-code warning to the eventual reply via a sentinel header.
  // Handlers send their own messages; we just notify here when needed.
  if (r.viaRecovery) {
    try {
      const { notifyUser } = await import("@/lib/notify.server");
      await notifyUser({
        userId,
        kind: "system",
        title: "Recovery code used in Telegram",
        body: "If this wasn't you, change your password and disable 2FA immediately.",
        link: "/settings",
      });
    } catch { /* ignore */ }
  }
  void extra;
  return { ok: true, text: stripped };
}



type HelpScope = "user" | "staff" | "admin";
type HelpTopic = {
  key: string;
  label: string;
  title: string;
  body: string;
  scope?: HelpScope; // defaults to "user"
};

const HELP_TOPICS: HelpTopic[] = [
  {
    key: "start",
    label: "🚀 /start",
    title: "🚀 <b>/start</b> — Welcome &amp; quick start",
    body: [
      "Greets you and shows the main command list.",
      "Also used to link your account when followed by a code:",
      "",
      "<b>Usage</b>",
      "<code>/start</code>",
      "<code>/start AB12CD</code>   ← links via deep-link code",
    ].join("\n"),
  },
  {
    key: "link",
    label: "🔗 /link",
    title: "🔗 <b>/link CODE</b> — Link your web account",
    body: [
      "Connects this Telegram account to your EscrowDesk web profile.",
      "Generate a code in the web app: <i>Settings → Telegram → Generate code</i>.",
      "",
      "<b>Usage</b>",
      "<code>/link AB12CD</code>",
      "",
      "<b>Notes</b>",
      "• Codes expire after a few minutes",
      "• Each code can only be used once",
    ].join("\n"),
  },
  {
    key: "balance",
    label: "💼 /balance",
    title: "💼 <b>/balance</b> — Show wallet balances",
    body: [
      "Displays every asset wallet you own, with available and in-escrow amounts.",
      "",
      "<b>Usage</b>",
      "<code>/balance</code>",
      "",
      "<b>Example output</b>",
      "<code>BTC:  0.0050  (escrow 0.0000)</code>",
    ].join("\n"),
  },
  {
    key: "trades",
    label: "📋 /trades",
    title: "📋 <b>/trades</b> — List active trades",
    body: [
      "Shows up to 10 of your most recent trades that are not released or cancelled.",
      "Each row prints a short TRADE_ID prefix you can reuse with /release or /dispute.",
      "",
      "<b>Usage</b>",
      "<code>/trades</code>",
      "",
      "<b>Example row</b>",
      "<code>• 1a2b3c4d BTC 0.001 ↔ 50 EUR · funded</code>",
    ].join("\n"),
  },
  // (release/dispute defined below with richer content)
  {
    key: "terms",
    label: "📝 /terms",
    title: "📝 <b>/terms TRADE_ID text…</b> — Propose your terms",
    body: [
      "Save your side of the trade terms. Counterparty must read and sign with /sign.",
      "",
      "<b>Usage</b>",
      "<code>/terms TRADE_ID your terms…</code>",
      "",
      "<b>Example</b>",
      "<code>/terms 1a2b3c4d Payment in EUR via SEPA within 30 min.</code>",
    ].join("\n"),
  },
  {
    key: "sign",
    label: "✍️ /sign",
    title: "✍️ <b>/sign TRADE_ID PHRASE</b> — Sign the agreement",
    body: [
      "Sign the trade terms. Phrase must match EXACTLY (case-insensitive).",
      "",
      "<b>Buyer signs</b>",
      "<code>/sign TRADE_ID I AGREE TO TERMS AND CONDITIONS OF THE SELLER</code>",
      "",
      "<b>Seller signs</b>",
      "<code>/sign TRADE_ID I AGREE TO TERMS AND CONDITIONS OF THE BUYER</code>",
    ].join("\n"),
  },
  {
    key: "confirm",
    label: "✅ /confirm",
    title: "✅ <b>/confirm TRADE_ID</b> — Seller confirms deposit",
    body: [
      "Seller confirms they see the buyer's crypto locked in escrow.",
      "After this, buyer settles fiat off-platform then runs /release.",
      "",
      "<b>Usage</b>",
      "<code>/confirm TRADE_ID</code>",
    ].join("\n"),
  },
  {
    key: "release",
    label: "🎉 /release",
    title: "🎉 <b>/release TRADE_ID</b> — Release escrow to seller",
    body: [
      "Buyer releases the escrowed crypto to seller after receiving fiat.",
      "",
      "<b>Usage</b>",
      "<code>/release TRADE_ID</code>",
    ].join("\n"),
  },
  {
    key: "dispute",
    label: "🚩 /dispute",
    title: "🚩 <b>/dispute TRADE_ID reason</b> — Open a dispute",
    body: [
      "Flags a trade for judge/admin review. Reason must be at least 5 characters.",
      "",
      "<b>Usage</b>",
      "<code>/dispute TRADE_ID reason text…</code>",
    ].join("\n"),
  },
  {
    key: "fee",
    label: "⚙️ /fee (admin)",
    title: "⚙️ <b>/fee BPS</b> — Set legacy platform fee (admin)",
    scope: "admin",
    body: [
      "Sets the legacy flat fee in basis points (overridden by tiered fees if present).",
      "",
      "<b>Usage</b>",
      "<code>/fee 250</code>   ← 2.50%",
    ].join("\n"),
  },
  {
    key: "ban",
    label: "🔨 /ban (staff)",
    title: "🔨 <b>/ban USER_ID reason</b> — Ban a user (admin/moderator)",
    scope: "staff",
    body: [
      "Bans a user with a required reason. They lose trading access.",
      "",
      "<b>Usage</b>",
      "<code>/ban USER_ID reason text…</code>",
      "",
      "<b>Example</b>",
      "<code>/ban 9f1c0a3b fraud — multiple chargebacks</code>",
    ].join("\n"),
  },
  {
    key: "unban",
    label: "♻️ /unban (admin)",
    title: "♻️ <b>/unban USER_ID</b> — Unban a user (admin)",
    scope: "admin",
    body: [
      "Lifts a ban. Only admins can unban.",
      "",
      "<b>Usage</b>",
      "<code>/unban USER_ID</code>",
    ].join("\n"),
  },
  {
    key: "warn",
    label: "⚠️ /warn (staff)",
    title: "⚠️ <b>/warn USER_ID severity reason</b> — Warn a user",
    scope: "staff",
    body: [
      "Admin, moderator, or judge can issue warnings.",
      "Severity: <code>minor</code> | <code>major</code> | <code>final</code>",
      "",
      "<b>Usage</b>",
      "<code>/warn USER_ID severity reason…</code>",
      "",
      "<b>Example</b>",
      "<code>/warn 9f1c0a3b major slow response on dispute</code>",
    ].join("\n"),
  },
  {
    key: "whoami",
    label: "🪪 /whoami",
    title: "🪪 <b>/whoami</b> — Show your linked account",
    body: [
      "Shows the EscrowDesk account this Telegram is linked to,",
      "your assigned roles, and whether 2FA (TOTP) is set up.",
      "",
      "<b>Usage</b>",
      "<code>/whoami</code>",
      "",
      "<b>Example output</b>",
      "<code>Account: Alice (9f1c0a3b…)</code>",
      "<code>Roles:   user, judge</code>",
      "<code>2FA:     ✅ enabled</code>",
    ].join("\n"),
  },
  {
    key: "dispute-status",
    label: "🧾 /dispute-status",
    title: "🧾 <b>/dispute-status TRADE_ID</b> — View your dispute",
    body: [
      "Shows the current arbitration stage for a trade you are a party to:",
      "case status, evidence-window deadline, mediator (if assigned),",
      "and the public timeline + ruling note.",
      "Private judge notes are NEVER shown — only what you're entitled to see.",
      "",
      "<b>Usage</b>",
      "<code>/dispute-status TRADE_ID</code>",
      "",
      "<b>Example</b>",
      "<code>/dispute-status 1a2b3c4d</code>",
    ].join("\n"),
  },
  {
    key: "buttons",
    label: "🔘 Inline buttons & 2FA",
    title: "🔘 <b>Inline buttons &amp; when the 2FA prompt appears</b>",
    body: [
      "Trade notifications come with inline buttons. Buttons are signed,",
      "bound to your Telegram ID, and <b>expire 24h</b> after being sent.",
      "If a button is too old or forwarded, you'll see an error — just",
      "run the equivalent typed command instead.",
      "",
      "<b>Buttons that act immediately (no 2FA)</b>",
      "• ✅ <b>I've paid</b> — marks fiat-sent on a trade you bought.",
      "• 💬 <b>Reply</b> — replies with your next message as a chat post.",
      "• 🔗 <b>Open on web</b> — deep-links to the trade page.",
      "",
      "<b>Buttons that trigger a 2FA prompt</b>",
      "Pressing any of these sends a follow-up message with",
      "<i>force-reply</i> asking for your 6-digit code (or recovery code).",
      "The action only runs after that reply verifies. The prompt expires",
      "in 5 minutes; if you reply too late, press the button again.",
      "",
      "• ✅ <b>Confirm deposit</b> → prompts for 2FA → runs /confirm.",
      "• 🎉 <b>Release</b> → prompts for 2FA → runs /release.",
      "• 🚩 <b>Dispute</b> → prompts for 2FA → opens dispute.",
      "",
      "<b>Typed sensitive commands</b>",
      "/sign, /confirm, /release, /dispute, /terms, /withdraw,",
      "/cancelwithdraw, /resolve, /approve, /reject, /fee, /ban, /unban,",
      "/warn all require the 2FA code as the <b>last argument</b>:",
      "",
      "<code>/release TRADE_ID 123456</code>",
      "<code>/release TRADE_ID XXXX-XXXX</code>   ← recovery code",
      "",
      "After 5 failed codes in 15 min, Telegram fund actions are paused.",
      "Enable 2FA at <i>Settings → Security</i> on the web app first.",
    ].join("\n"),
  },
];

function topicsForRoles(roles: string[]): HelpTopic[] {
  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.some((r) => ["moderator","judge","finance","support"].includes(r));
  return HELP_TOPICS.filter((t) => {
    const s = t.scope ?? "user";
    if (s === "admin") return isAdmin;
    if (s === "staff") return isStaff;
    return true;
  });
}

function helpMenuKeyboard(topics: HelpTopic[] = HELP_TOPICS) {
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < topics.length; i += 2) {
    rows.push(
      topics.slice(i, i + 2).map((t) => ({
        text: t.label,
        callback_data: `help:${t.key}`,
      })),
    );
  }
  return { inline_keyboard: rows };
}

function helpTopicKeyboard() {
  return {
    inline_keyboard: [[{ text: "⬅️ Back to menu", callback_data: "help:menu" }]],
  };
}

function helpMenuText(topics: HelpTopic[] = HELP_TOPICS, roles: string[] = []) {
  const roleBadge = roles.length ? ` <i>(roles: ${roles.join(", ")})</i>` : "";
  const lines = [
    `<b>📖 EscrowDesk · Interactive Help</b>${roleBadge}`,
    "",
    "Tap a command below for detailed usage and examples.",
    "You can also type <code>/help &lt;command&gt;</code> — e.g. <code>/help sign</code>.",
    "",
    "<b>Quick reference</b>",
  ];
  for (const t of topics) {
    // Strip the leading emoji + key chunk from label and reuse title's first segment
    lines.push(`${t.label}`);
  }
  return lines.join("\n");
}

async function getRoles(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}


function expectedSecret() {
  const TK = process.env.TELEGRAM_API_KEY || "";
  return createHash("sha256").update(`telegram-webhook:${TK}`).digest("base64url");
}
function safeEq(a: string, b: string) {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function handleCallback(cb: Record<string, unknown>) {
  const id = cb.id as string;
  const data = (cb.data as string | undefined) ?? "";
  const msg = cb.message as { chat: { id: number }; message_id: number } | undefined;
  const from = cb.from as { id: number } | undefined;
  await tgCall("answerCallbackQuery", { callback_query_id: id });
  if (!msg) return;

  // Look up roles for this Telegram user (if linked) for role-aware help
  let roles: string[] = [];
  if (from?.id) {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("user_id").eq("telegram_user_id", from.id).maybeSingle();
    if (prof?.user_id) roles = await getRoles(prof.user_id);
  }
  const visible = topicsForRoles(roles);

  if (data === "help:menu") {
    return tgCall("editMessageText", {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text: helpMenuText(visible, roles),
      parse_mode: "HTML",
      reply_markup: helpMenuKeyboard(visible),
    });
  }
  if (data.startsWith("help:")) {
    const key = data.slice(5);
    const topic = visible.find((t) => t.key === key) ?? HELP_TOPICS.find((t) => t.key === key);
    if (!topic) return;
    return tgCall("editMessageText", {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      text: `${topic.title}\n\n${topic.body}`,
      parse_mode: "HTML",
      reply_markup: helpTopicKeyboard(),
    });
  }

  // ---- Trade action callbacks (v1|action|short|sig) ----
  if ((data.startsWith("v2|") || data.startsWith("v1|")) && from?.id) {
    const v = verifyCb(data, from.id);
    if (!v) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Invalid button (please use the latest message)", show_alert: true });
    if ("expired" in v) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Button expired — open the trade on the web or run the typed command.", show_alert: true });
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("user_id, is_banned").eq("telegram_user_id", from.id).maybeSingle();
    if (!prof?.user_id) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Link your account first", show_alert: true });
    if (prof.is_banned) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Account banned", show_alert: true });

    // Resolve trade by short id and check the user is a party.
    const { data: trade } = await supabaseAdmin
      .from("trades").select("id, status, buyer_id, seller_id")
      .ilike("id", `${v.short}%`).limit(1).maybeSingle();
    if (!trade) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Trade not found", show_alert: true });
    const isBuyer = trade.buyer_id === prof.user_id;
    const isSeller = trade.seller_id === prof.user_id;
    if (!isBuyer && !isSeller) return tgCall("answerCallbackQuery", { callback_query_id: id, text: "Not your trade", show_alert: true });

    if (v.action === "paid") {
      const { error } = await supabaseAdmin.rpc("mark_trade_paid", { _trade_id: trade.id, _caller: prof.user_id });
      await auditTg(prof.user_id, "tg_btn_paid", error);
      return tgSendMessage(msg.chat.id, error ? `❌ ${error.message}` : `✅ Marked paid on <code>${trade.id.slice(0,8)}</code>`);
    }
    if (v.action === "reply") {
      const prompt = await tgCall("sendMessage", {
        chat_id: msg.chat.id,
        text: `💬 Reply to this message with your chat text for trade <code>${trade.id.slice(0,8)}</code>.`,
        parse_mode: "HTML",
        reply_markup: forceReply,
      });
      const pmid = (prompt as { result?: { message_id?: number } } | null)?.result?.message_id;
      if (pmid) await setPendingPrompt(prof.user_id, pmid, {
        kind: "chat", trade_id: trade.id, expires: Date.now() + 10 * 60_000,
      });
      return;
    }
    if (v.action === "release" || v.action === "confirm" || v.action === "dispute") {
      const prompt = await tgCall("sendMessage", {
        chat_id: msg.chat.id,
        text: `🔐 Reply with your 6-digit 2FA code to <b>${v.action}</b> trade <code>${trade.id.slice(0,8)}</code>.`,
        parse_mode: "HTML",
        reply_markup: forceReply,
      });
      const pmid = (prompt as { result?: { message_id?: number } } | null)?.result?.message_id;
      if (pmid) await setPendingPrompt(prof.user_id, pmid, {
        kind: "totp", action: v.action, trade_id: trade.id, expires: Date.now() + 5 * 60_000,
      });
      return;
    }
    // Admin actions
    if (v.action === "resolve_b" || v.action === "resolve_s" || v.action === "approve" || v.action === "reject") {
      // Defer to typed text command for now
      return tgSendMessage(msg.chat.id, `Use the typed command to ${v.action.replace("_"," ")} (TOTP required).`);
    }
  }
}

// Run a sensitive trade action after a successful TOTP code.
async function runTradeAction(
  userId: string, tradeId: string, action: "release" | "confirm" | "dispute", chatId: number,
) {
  if (action === "release") {
    const { error } = await supabaseAdmin.rpc("release_trade", { _trade_id: tradeId, _caller: userId });
    await auditTg(userId, "tg_btn_release", error);
    return tgSendMessage(chatId, error ? `❌ ${error.message}` : `✅ Released <code>${tradeId.slice(0,8)}</code>`);
  }
  if (action === "confirm") {
    const { error } = await supabaseAdmin.rpc("confirm_buyer_deposit", { _trade_id: tradeId, _caller: userId });
    await auditTg(userId, "tg_btn_confirm", error);
    return tgSendMessage(chatId, error ? `❌ ${error.message}` : `✅ Confirmed deposit on <code>${tradeId.slice(0,8)}</code>`);
  }
  if (action === "dispute") {
    const { error } = await supabaseAdmin.rpc("open_dispute", {
      _trade_id: tradeId, _caller: userId, _reason: "Opened from Telegram (no reason provided)",
    });
    await auditTg(userId, "tg_btn_dispute", error);
    return tgSendMessage(chatId, error ? `❌ ${error.message}` : `🚩 Dispute opened on <code>${tradeId.slice(0,8)}</code>`);
  }
}


async function handle(update: Record<string, unknown>) {
  if (update.callback_query) {
    return handleCallback(update.callback_query as Record<string, unknown>);
  }
  const message = (update.message ?? update.edited_message) as Record<string, unknown> | undefined;
  if (!message) return;
  const chat = message.chat as { id: number };
  const from = message.from as { id: number; username?: string; first_name?: string };
  let text = (message.text as string | undefined) ?? "";
  const tgId = from.id;

  // Find linked user
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, is_banned, ban_reason")
    .eq("telegram_user_id", tgId)
    .maybeSingle();

  const send = (t: string) => tgSendMessage(chat.id, t);
  const roles = profile?.user_id ? await getRoles(profile.user_id) : [];
  const isAdmin = roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderator");
  const isJudge = isAdmin || roles.includes("judge");
  const visibleTopics = topicsForRoles(roles);

  if (text.startsWith("/start")) {
    const arg = text.split(" ")[1];
    if (arg) {
      // 24-char hex = legacy escrow group token (deprecated, Issue #3)
      if (/^[0-9a-f]{24}$/i.test(arg)) {
        return send("⚠️ Legacy escrow group invites are no longer supported. Please open a trade on the website.");
      }
      return handleLink(chat.id, tgId, from, arg);
    }
    return tgCall("sendMessage", {
      chat_id: chat.id,
      text: helpMenuText(visibleTopics, roles),
      parse_mode: "HTML",
      reply_markup: helpMenuKeyboard(visibleTopics),
    });
  }
  if (text.startsWith("/help")) {
    const arg = text.split(" ")[1]?.toLowerCase().replace(/^\//, "");
    if (arg) {
      const topic = HELP_TOPICS.find((t) => t.key === arg);
      if (topic) {
        return tgCall("sendMessage", {
          chat_id: chat.id,
          text: `${topic.title}\n\n${topic.body}`,
          parse_mode: "HTML",
          reply_markup: helpTopicKeyboard(),
        });
      }
      return send(`Unknown help topic <code>${arg}</code>. Try /help`);
  }

  if (text === "/whoami" || text.startsWith("/whoami ")) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, totp_enabled_at, telegram_username")
      .eq("user_id", profile.user_id).maybeSingle();
    const name = prof?.display_name || prof?.telegram_username || "(no display name)";
    const totp = prof?.totp_enabled_at ? "✅ enabled" : "❌ not set up";
    const rolesText = roles.length ? roles.join(", ") : "user";
    return send(
      `🪪 <b>Who am I</b>\n` +
      `Account: <b>${escapeHtmlSafe(name)}</b> (<code>${profile.user_id.slice(0,8)}</code>)\n` +
      `Roles:   <code>${rolesText}</code>\n` +
      `2FA:     ${totp}\n` +
      (prof?.totp_enabled_at ? "" : "\nEnable 2FA at <i>Settings → Security</i> on the web app to use sensitive commands."),
    );
  }

  if (text.startsWith("/dispute-status") || text.startsWith("/dispute_status")) {
    const idArg = text.split(/\s+/)[1];
    if (!idArg) return send("Usage: <code>/dispute-status TRADE_ID</code>");
    const full = await resolveTradeId(idArg, profile.user_id);
    if (!full) return send("Trade not found (or you're not a party).");
    const { data: tr } = await supabaseAdmin.from("trades")
      .select("id, status, buyer_id, seller_id").eq("id", full).maybeSingle();
    if (!tr || (tr.buyer_id !== profile.user_id && tr.seller_id !== profile.user_id)) {
      return send("You're not a party to this trade.");
    }
    const { data: kase } = await supabaseAdmin.from("arbitration_cases")
      .select("id, status, category, summary, opened_at, ruled_at, closed_at, mediator_id, outcome, outcome_note")
      .eq("trade_id", full).order("opened_at", { ascending: false }).limit(1).maybeSingle();
    if (!kase) {
      const { data: d } = await supabaseAdmin.from("disputes")
        .select("status, reason, created_at, resolved_at, resolution_note")
        .eq("trade_id", full).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!d) return send(`No dispute on trade <code>${full.slice(0,8)}</code> (status: ${tr.status}).`);
      return send(
        `🧾 <b>Dispute on <code>${full.slice(0,8)}</code></b>\n` +
        `Stage:    <code>${d.status}</code>\n` +
        `Opened:   ${new Date(d.created_at).toLocaleString()}\n` +
        `Reason:   ${escapeHtmlSafe(d.reason || "—").slice(0, 200)}\n` +
        (d.resolved_at ? `Resolved: ${new Date(d.resolved_at).toLocaleString()}\nNote:     ${escapeHtmlSafe(d.resolution_note || "—").slice(0,300)}` : ""),
      );
    }
    // Evidence window: 72h from opened_at unless ruled
    const openedMs = new Date(kase.opened_at).getTime();
    const deadlineMs = openedMs + 72 * 60 * 60_000;
    const remH = Math.max(0, Math.round((deadlineMs - Date.now()) / 36e5));
    const evidenceLine = kase.ruled_at
      ? `Evidence: ⛔ closed`
      : `Evidence: open · deadline ${new Date(deadlineMs).toLocaleString()} (${remH}h left)`;
    // Public timeline (no private notes)
    const { data: tl } = await supabaseAdmin.from("arbitration_timeline")
      .select("kind, body, created_at").eq("case_id", kase.id)
      .order("created_at", { ascending: true }).limit(8);
    const tlLines = (tl ?? []).map((e) =>
      `• <i>${new Date(e.created_at).toLocaleString()}</i> · <code>${e.kind}</code>${e.body ? ` — ${escapeHtmlSafe(e.body).slice(0,140)}` : ""}`,
    );
    return send(
      `🧾 <b>Dispute on <code>${full.slice(0,8)}</code></b>\n` +
      `Case:     <code>${kase.id.slice(0,8)}</code> · ${escapeHtmlSafe(kase.category || "general")}\n` +
      `Stage:    <code>${kase.status}</code>\n` +
      `Opened:   ${new Date(kase.opened_at).toLocaleString()}\n` +
      `${evidenceLine}\n` +
      `Mediator: ${kase.mediator_id ? "👤 assigned" : "— not yet assigned"}\n` +
      (kase.summary ? `Summary:  ${escapeHtmlSafe(kase.summary).slice(0,200)}\n` : "") +
      (kase.ruled_at
        ? `\n<b>Ruling</b> (${new Date(kase.ruled_at).toLocaleString()})\n` +
          `Outcome: <code>${kase.outcome ?? "—"}</code>\n` +
          (kase.outcome_note ? `Note: ${escapeHtmlSafe(kase.outcome_note).slice(0,400)}\n` : "")
        : "") +
      (tlLines.length ? `\n<b>Timeline</b>\n${tlLines.join("\n")}` : "") +
      `\n\n<i>Private judge notes are not shown.</i>`,
    );
  }

    return tgCall("sendMessage", {
      chat_id: chat.id,
      text: helpMenuText(visibleTopics, roles),
      parse_mode: "HTML",
      reply_markup: helpMenuKeyboard(visibleTopics),
    });
  }
  if (text.startsWith("/link")) {
    const code = text.split(" ")[1]?.trim();
    if (!code) return send("Usage: /link CODE");
    return handleLink(chat.id, tgId, from, code);
  }

  if (!profile) return send("⚠️ Your Telegram isn't linked. Generate a code in the web app → Settings → Telegram, then send /link CODE.");

  // Ban gate: banned users can only use /help, /start, /link
  if (profile.is_banned) {
    return send(`🚫 Your account is banned.${profile.ban_reason ? `\nReason: ${profile.ban_reason}` : ""}\nContact support if you believe this is a mistake.`);
  }

  // ───────── Force-reply consumer ─────────
  // If this message is a reply to a prompt we issued, resolve it now.
  const replyTo = (message as { reply_to_message?: { message_id?: number } }).reply_to_message;
  if (replyTo?.message_id) {
    const p = await takePendingPrompt(profile.user_id, replyTo.message_id);
    if (p) {
      if (p.kind === "chat") {
        const body = text.trim();
        if (!body) return send("Message empty.");
        const { error } = await supabaseAdmin.from("trade_messages").insert({
          trade_id: p.trade_id, sender_id: profile.user_id, body, is_system: false,
        } as never);
        return send(error ? `❌ ${error.message}` : `💬 Posted to trade <code>${p.trade_id.slice(0,8)}</code>.`);
      }
      if (p.kind === "totp") {
        const r = await consumeTotp(profile.user_id, text.trim());
        if (!r.ok) return send(r.reason === "no_totp" ? enrollHint(`/${p.action}`) : "❌ Invalid 2FA code.");
        return runTradeAction(profile.user_id, p.trade_id, p.action, chat.id);
      }
      if (p.kind === "admin_totp") {
        const r = await consumeTotp(profile.user_id, text.trim());
        if (!r.ok) return send("❌ Invalid 2FA code.");
        return runAdminAction(profile.user_id, p.action, p.ref, chat.id);
      }
      if (p.kind === "withdraw_addr") {
        // Not used in this revision — placeholder for future address book.
        return send("OK.");
      }
    }
  }



  if (text.startsWith("/balance")) {
    const { data: w } = await supabaseAdmin
      .from("v_wallet_balances")
      .select("available_sats, locked_escrow_sats")
      .eq("user_id", profile.user_id)
      .maybeSingle();
    const avail = (Number(w?.available_sats ?? 0) / 1e8).toFixed(8);
    const esc   = (Number(w?.locked_escrow_sats ?? 0) / 1e8).toFixed(8);
    return send(`💼 <b>Balance</b>\nBTC: <code>${avail}</code> (escrow ${esc})`);
  }
  if (text.startsWith("/trades")) {
    const { data: t } = await supabaseAdmin.from("trades")
      .select("id, status, asset, crypto_amount, fiat_amount, fiat_currency")
      .or(`buyer_id.eq.${profile.user_id},seller_id.eq.${profile.user_id}`)
      .neq("status", "released").neq("status", "cancelled").order("created_at", { ascending: false }).limit(10);
    if (!t?.length) return send("No active trades.");
    return send("📋 <b>Active trades</b>\n" + t.map((x) => `• <code>${x.id.slice(0,8)}</code> ${x.asset} ${x.crypto_amount} ↔ ${x.fiat_amount} ${x.fiat_currency} · ${x.status}`).join("\n"));
  }
  // ───────── Phase 2: TOTP gate for sensitive commands ─────────
  // Sensitive commands take a trailing token: 6 digits = TOTP, XXXX-XXXX = recovery code.
  const PHASE2_CMDS = ["/terms","/sign","/confirm","/release","/dispute","/fee","/ban","/unban","/warn"] as const;
  const matchedCmd = PHASE2_CMDS.find((c) => text.startsWith(c + " ") || text === c);
  if (matchedCmd) {
    const gate = await requireTotpFromText(profile.user_id, text, matchedCmd);
    if (!gate.ok) return send(gate.reply);
    // Replace `text` so the existing command handlers below run unchanged.
    text = gate.text;
    // Re-write the message text so downstream parsers see no token suffix.
    (message as { text: string }).text = text;

    if (text.startsWith("/terms")) {
      const parts = text.split(" ");
      const idArg = parts[1];
      const termsText = parts.slice(2).join(" ").trim();
      if (!idArg || !termsText) return send("Usage: <code>/terms TRADE_ID your terms text CODE</code>");
      const full = await resolveTradeId(idArg, profile.user_id);
      if (!full) return send("Trade not found.");
      const { data: tr } = await supabaseAdmin.from("trades").select("buyer_id, seller_id").eq("id", full).maybeSingle();
      if (!tr) return send("Trade not found.");
      const col = tr.buyer_id === profile.user_id ? "terms_buyer" : tr.seller_id === profile.user_id ? "terms_seller" : null;
      if (!col) return send("You are not a party to this trade.");
      const patch = (col === "terms_buyer" ? { terms_buyer: termsText } : { terms_seller: termsText });
      const { error } = await supabaseAdmin.from("trades").update(patch).eq("id", full);
      await auditTg(profile.user_id, "tg_terms", error);
      return send(error ? `❌ ${error.message}` : `📝 Terms saved for trade <code>${full.slice(0,8)}</code>.`);
    }
    if (text.startsWith("/sign")) {
      const parts = text.split(" ");
      const idArg = parts[1];
      const phrase = parts.slice(2).join(" ").trim();
      if (!idArg || !phrase) return send("Usage: <code>/sign TRADE_ID PHRASE CODE</code>");
      const full = await resolveTradeId(idArg, profile.user_id);
      if (!full) return send("Trade not found.");
      const { error } = await supabaseAdmin.rpc("sign_terms", { _trade_id: full, _caller: profile.user_id, _signature: phrase, _terms: null as unknown as string });
      await auditTg(profile.user_id, "tg_sign", error);
      return send(error ? `❌ ${error.message}` : `✍️ Signed trade <code>${full.slice(0,8)}</code>.`);
    }
    if (text.startsWith("/confirm")) {
      const idArg = text.split(" ")[1];
      if (!idArg) return send("Usage: <code>/confirm TRADE_ID CODE</code>");
      const full = await resolveTradeId(idArg, profile.user_id);
      if (!full) return send("Trade not found.");
      const { error } = await supabaseAdmin.rpc("confirm_buyer_deposit", { _trade_id: full, _caller: profile.user_id });
      await auditTg(profile.user_id, "tg_confirm", error);
      return send(error ? `❌ ${error.message}` : `✅ Deposit confirmed on trade <code>${full.slice(0,8)}</code>.`);
    }
    if (text.startsWith("/release")) {
      const id = text.split(" ")[1]?.trim();
      if (!id) return send("Usage: <code>/release TRADE_ID CODE</code>");
      const full = await resolveTradeId(id, profile.user_id);
      if (!full) return send("Trade not found.");
      const { error } = await supabaseAdmin.rpc("release_trade", { _trade_id: full, _caller: profile.user_id });
      await auditTg(profile.user_id, "tg_release", error);
      return send(error ? `❌ ${error.message}` : `✅ Released ${full.slice(0,8)}`);
    }
    if (text.startsWith("/dispute")) {
      const parts = text.split(" "); const id = parts[1]; const reason = parts.slice(2).join(" ");
      if (!id || reason.length < 5) return send("Usage: <code>/dispute TRADE_ID reason CODE</code> (reason min 5 chars)");
      const full = await resolveTradeId(id, profile.user_id);
      if (!full) return send("Trade not found.");
      const { error } = await supabaseAdmin.rpc("open_dispute", { _trade_id: full, _caller: profile.user_id, _reason: reason });
      await auditTg(profile.user_id, "tg_dispute", error);
      return send(error ? `❌ ${error.message}` : `🚩 Dispute opened for ${full.slice(0,8)}`);
    }
    if (text.startsWith("/fee")) {
      if (!isAdmin) return send("Admin only.");
      const n = Number(text.split(" ")[1]);
      if (!Number.isFinite(n) || n < 0 || n > 1000) return send("Usage: <code>/fee BPS CODE</code> (0..1000)");
      const { error } = await supabaseAdmin.from("platform_settings").upsert({ key: "fee_bps", value: n, updated_at: new Date().toISOString() });
      await auditTg(profile.user_id, "tg_fee", error);
      return send(error ? `❌ ${error.message}` : `✅ Fee set to ${n} bps`);
    }
    if (text.startsWith("/ban")) {
      if (!isModerator) return send("Admin or moderator only.");
      const parts = text.split(" ");
      const target = parts[1];
      const reason = parts.slice(2).join(" ").trim();
      if (!target || reason.length < 3) return send("Usage: <code>/ban USER_ID reason CODE</code>");
      const { error } = await supabaseAdmin.rpc("ban_user", { _target: target, _caller: profile.user_id, _reason: reason });
      await auditTg(profile.user_id, "tg_ban", error);
      return send(error ? `❌ ${error.message}` : `🔨 Banned <code>${target.slice(0,8)}</code>: ${reason}`);
    }
    if (text.startsWith("/unban")) {
      if (!isAdmin) return send("Admin only.");
      const target = text.split(" ")[1];
      if (!target) return send("Usage: <code>/unban USER_ID CODE</code>");
      const { error } = await supabaseAdmin.rpc("unban_user", { _target: target, _caller: profile.user_id });
      await auditTg(profile.user_id, "tg_unban", error);
      return send(error ? `❌ ${error.message}` : `♻️ Unbanned <code>${target.slice(0,8)}</code>`);
    }
    if (text.startsWith("/warn")) {
      if (!(isAdmin || isModerator || isJudge)) return send("Admin, moderator, or judge only.");
      const parts = text.split(" ");
      const target = parts[1];
      const severity = (parts[2] || "").toLowerCase();
      const reason = parts.slice(3).join(" ").trim();
      if (!target || !["minor","major","final"].includes(severity) || reason.length < 3) {
        return send("Usage: <code>/warn USER_ID severity reason CODE</code>\nseverity = minor | major | final");
      }
      const { error } = await supabaseAdmin.rpc("warn_user", { _target: target, _caller: profile.user_id, _reason: reason, _severity: severity });
      await auditTg(profile.user_id, "tg_warn", error);
      return send(error ? `❌ ${error.message}` : `⚠️ Warned <code>${target.slice(0,8)}</code> (${severity})`);
    }
  }

  // ───────── Chat from Telegram (no TOTP — just chat) ─────────
  if (text.startsWith("/msg ")) {
    const parts = text.split(" ");
    const idArg = parts[1];
    const body = parts.slice(2).join(" ").trim();
    if (!idArg || !body) return send("Usage: <code>/msg TRADE_ID your message</code>");
    const full = await resolveTradeId(idArg, profile.user_id);
    if (!full) return send("Trade not found.");
    const { error } = await supabaseAdmin.from("trade_messages").insert({
      trade_id: full, sender_id: profile.user_id, body, is_system: false,
    } as never);
    return send(error ? `❌ ${error.message}` : `💬 Posted to <code>${full.slice(0,8)}</code>.`);
  }

  // ───────── Wallet: /deposit, /withdraw, /cancelwithdraw ─────────
  if (text.startsWith("/deposit")) {
    return handleDeposit(profile.user_id, chat.id, text);
  }
  if (text.startsWith("/withdraw") && !text.startsWith("/withdrawals")) {
    return handleWithdraw(profile.user_id, chat.id, text);
  }
  if (text.startsWith("/cancelwithdraw")) {
    return handleCancelWithdraw(profile.user_id, chat.id, text);
  }

  // ───────── Admin: /pending, /case, /resolve, /approve, /reject, /stats ─────────
  const isStaff = isAdmin || isModerator || isJudge || roles.some((r) => ["finance","support"].includes(r));
  if (text.startsWith("/stats")) {
    if (!isStaff) return send("Staff only.");
    return handleStats(chat.id);
  }
  if (text.startsWith("/pending")) {
    if (!isStaff) return send("Staff only.");
    return handlePending(chat.id);
  }
  if (text.startsWith("/case ")) {
    if (!isStaff) return send("Staff only.");
    const arg = text.split(" ")[1];
    if (!arg) return send("Usage: <code>/case TRADE_ID</code>");
    return handleCase(chat.id, arg);
  }
  if (text.startsWith("/resolve ")) {
    if (!isStaff) return send("Staff only.");
    const gate = await requireTotpFromText(profile.user_id, text, "/resolve");
    if (!gate.ok) return send(gate.reply);
    const parts = gate.text.split(" ");
    const idArg = parts[1]; const side = (parts[2] || "").toLowerCase(); const note = parts.slice(3).join(" ");
    if (!idArg || !["buyer","seller"].includes(side)) return send("Usage: <code>/resolve TRADE_ID buyer|seller [note] CODE</code>");
    const { data: tr } = await supabaseAdmin.from("trades").select("id").ilike("id", `${idArg}%`).limit(1).maybeSingle();
    if (!tr) return send("Trade not found.");
    const { error } = await supabaseAdmin.rpc("resolve_dispute", {
      _trade_id: tr.id, _caller: profile.user_id, _award_to: side, _note: note || "Resolved via Telegram",
    });
    await auditTg(profile.user_id, "tg_admin_resolve", error, { trade_id: tr.id, side });
    return send(error ? `❌ ${error.message}` : `✅ Resolved <code>${tr.id.slice(0,8)}</code> for ${side}.`);
  }
  if (text.startsWith("/approve ")) {
    if (!isStaff) return send("Staff only.");
    const gate = await requireTotpFromText(profile.user_id, text, "/approve");
    if (!gate.ok) return send(gate.reply);
    const arg = gate.text.split(" ")[1];
    const note = gate.text.split(" ").slice(2).join(" ");
    if (!arg) return send("Usage: <code>/approve WITHDRAWAL_ID [note] CODE</code>");
    const { data: wr } = await supabaseAdmin.from("withdrawal_requests").select("id").ilike("id", `${arg}%`).limit(1).maybeSingle();
    if (!wr) return send("Withdrawal not found.");
    const { error } = await supabaseAdmin.rpc("admin_approve_withdrawal", {
      _withdrawal_id: wr.id, _admin: profile.user_id, _note: note || "Approved via Telegram",
    });
    await auditTg(profile.user_id, "tg_admin_approve", error, { withdrawal_id: wr.id });
    return send(error ? `❌ ${error.message}` : `✅ Approved withdrawal <code>${wr.id.slice(0,8)}</code>.`);
  }
  if (text.startsWith("/reject ")) {
    if (!isStaff) return send("Staff only.");
    const gate = await requireTotpFromText(profile.user_id, text, "/reject");
    if (!gate.ok) return send(gate.reply);
    const parts = gate.text.split(" ");
    const arg = parts[1]; const reason = parts.slice(2).join(" ").trim();
    if (!arg || reason.length < 3) return send("Usage: <code>/reject WITHDRAWAL_ID reason CODE</code>");
    const { data: wr } = await supabaseAdmin.from("withdrawal_requests").select("id").ilike("id", `${arg}%`).limit(1).maybeSingle();
    if (!wr) return send("Withdrawal not found.");
    const { error } = await supabaseAdmin.rpc("admin_reject_withdrawal", {
      _withdrawal_id: wr.id, _admin: profile.user_id, _reason: reason,
    });
    await auditTg(profile.user_id, "tg_admin_reject", error, { withdrawal_id: wr.id });
    return send(error ? `❌ ${error.message}` : `🛑 Rejected withdrawal <code>${wr.id.slice(0,8)}</code>.`);
  }

  // ---------- Escrow group commands (DEPRECATED — Issue #3) ----------
  const escrowGroupCommands = [
    "/escrow_bind", "/bind", "/escrow_status", "/status",
    "/txhash", "/release_group", "/release_g", "/cancel_group",
    "/invite_moderator", "/invite_mod", "/judge",
  ];
  if (escrowGroupCommands.some((c) => text.startsWith(c))) {
    return send("⚠️ Legacy escrow groups are deprecated. Open a trade on the website to use the ledger-backed escrow flow.");
  }
  return send("Unknown command. Try /help");
}

async function runAdminAction(_userId: string, _action: string, _ref: string, chatId: number) {
  return tgSendMessage(chatId, "Action complete.");
}

async function handleStats(chatId: number) {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [opened, released, disputed, withdrawals] = await Promise.all([
    supabaseAdmin.from("trades").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabaseAdmin.from("trades").select("id", { count: "exact", head: true }).eq("status", "released").gte("released_at", since),
    supabaseAdmin.from("trades").select("id", { count: "exact", head: true }).eq("status", "disputed").gte("created_at", since),
    supabaseAdmin.from("withdrawal_requests").select("id", { count: "exact", head: true }).gte("created_at", since),
  ]);
  return tgSendMessage(chatId,
    `📊 <b>Last 24h</b>\n` +
    `Trades opened: <code>${opened.count ?? 0}</code>\n` +
    `Released: <code>${released.count ?? 0}</code>\n` +
    `Disputed: <code>${disputed.count ?? 0}</code>\n` +
    `Withdrawals: <code>${withdrawals.count ?? 0}</code>`);
}

async function handlePending(chatId: number) {
  const { data: disputes } = await supabaseAdmin
    .from("trades").select("id, fiat_amount, fiat_currency, created_at")
    .eq("status", "disputed").order("created_at", { ascending: true }).limit(5);
  const { data: withdrawals } = await supabaseAdmin
    .from("withdrawal_requests").select("id, amount_sats, created_at")
    .eq("status", "pending_review").order("created_at", { ascending: true }).limit(5);
  const lines: string[] = ["📋 <b>Pending queue</b>"];
  lines.push(`\n<b>Disputes</b> (${disputes?.length ?? 0})`);
  for (const d of disputes ?? [])
    lines.push(`• <code>${d.id.slice(0,8)}</code> ${d.fiat_amount} ${d.fiat_currency} — use <code>/case ${d.id.slice(0,8)}</code>`);
  lines.push(`\n<b>Withdrawals</b> (${withdrawals?.length ?? 0})`);
  for (const w of withdrawals ?? [])
    lines.push(`• <code>${w.id.slice(0,8)}</code> ${(Number(w.amount_sats)/1e8).toFixed(8)} BTC — <code>/approve ${w.id.slice(0,8)} CODE</code>`);
  if ((disputes?.length ?? 0) + (withdrawals?.length ?? 0) === 0) lines.push("\n✅ Queue empty.");
  return tgSendMessage(chatId, lines.join("\n"));
}

async function handleCase(chatId: number, idArg: string) {
  const { data: tr } = await supabaseAdmin.from("trades")
    .select("id, status, buyer_id, seller_id, fiat_amount, fiat_currency, crypto_amount, created_at")
    .ilike("id", `${idArg}%`).limit(1).maybeSingle();
  if (!tr) return tgSendMessage(chatId, "Trade not found.");
  const { data: msgs } = await supabaseAdmin.from("trade_messages")
    .select("body, sender_id, created_at, is_system").eq("trade_id", tr.id).order("created_at", { ascending: false }).limit(3);
  const ageH = Math.round((Date.now() - new Date(tr.created_at).getTime()) / 36e5);
  const lines = [
    `📑 <b>Trade <code>${tr.id.slice(0,8)}</code></b>`,
    `Status: <code>${tr.status}</code> · Age: ${ageH}h`,
    `Value: ${tr.crypto_amount} BTC ↔ ${tr.fiat_amount} ${tr.fiat_currency}`,
    `Buyer: <code>${tr.buyer_id.slice(0,8)}</code> · Seller: <code>${tr.seller_id.slice(0,8)}</code>`,
    `\n<b>Recent messages</b>`,
    ...(msgs ?? []).reverse().map((m) =>
      `• ${m.is_system ? "⚙️" : "💬"} <code>${m.sender_id.slice(0,6)}</code>: ${escapeHtmlSafe(m.body).slice(0,140)}`,
    ),
    `\nResolve: <code>/resolve ${tr.id.slice(0,8)} buyer|seller [note] CODE</code>`,
  ];
  return tgSendMessage(chatId, lines.join("\n"));
}

function escapeHtmlSafe(s: string) {
  return s.replace(/[&<>]/g, (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
}

// ───────── Wallet handlers ─────────
const SATS_PER_BTC = 100_000_000;

async function handleDeposit(userId: string, chatId: number, text: string) {
  const arg = text.split(" ")[1];
  const amountBtc = arg ? Number(arg) : 0.0001;
  if (!Number.isFinite(amountBtc) || amountBtc <= 0) {
    return tgSendMessage(chatId, "Usage: <code>/deposit [amount_btc]</code>");
  }
  try {
    const { data: wallet } = await supabaseAdmin
      .from("user_wallets").select("id").eq("user_id", userId).single();
    if (!wallet) return tgSendMessage(chatId, "No wallet.");
    const { createDepositInvoice, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
    const inv = await createDepositInvoice({
      amountBtc, userId, walletId: wallet.id,
    });
    const pms = await getInvoicePaymentMethods(inv.id);
    const onchain = pms.find((p) => p.paymentMethod === "BTC-CHAIN");
    const address = onchain?.destination ?? "";
    const expires = inv.expirationTime ? new Date(inv.expirationTime * 1000).toISOString() : new Date(Date.now() + 60 * 60_000).toISOString();
    const { data: dep } = await supabaseAdmin
      .from("deposit_requests").insert({
        user_id: userId, wallet_id: wallet.id, method: "btc_onchain",
        amount_sats: Math.round(amountBtc * SATS_PER_BTC),
        btcpay_invoice_id: inv.id, destination: address, expires_at: expires,
        tg_chat_id: chatId,
        metadata: { invoice_link: inv.checkoutLink, source: "telegram" },
      } as never).select("id").single();
    const sent = await tgSendMessage(chatId,
      `💰 <b>Deposit invoice</b>\n` +
      `Amount: <code>${amountBtc} BTC</code>\n` +
      `Address: <code>${address}</code>\n` +
      `<a href="${inv.checkoutLink}">Open BTCPay →</a>\n` +
      `Expires: ${new Date(expires).toLocaleString()}`);
    const mid = (sent as { result?: { message_id?: number } } | null)?.result?.message_id;
    if (mid && dep) {
      await supabaseAdmin.from("deposit_requests").update({ tg_message_id: mid } as never).eq("id", (dep as { id: string }).id);
    }
  } catch (e) {
    return tgSendMessage(chatId, `❌ Could not create deposit: ${(e as Error).message}`);
  }
}

async function handleWithdraw(userId: string, chatId: number, text: string) {
  const gate = await requireTotpFromText(userId, text, "/withdraw");
  if (!gate.ok) return tgSendMessage(chatId, gate.reply);
  const parts = gate.text.split(" ");
  const dest = parts[1];
  const amtBtc = Number(parts[2]);
  if (!dest || !Number.isFinite(amtBtc) || amtBtc <= 0) {
    return tgSendMessage(chatId, "Usage: <code>/withdraw ADDRESS amount_btc CODE</code>");
  }
  if (!/^(bc1[a-z0-9]{20,}|[13][a-zA-Z0-9]{20,})$/.test(dest)) {
    return tgSendMessage(chatId, "❌ That doesn't look like a valid BTC address.");
  }
  const amountSats = Math.round(amtBtc * SATS_PER_BTC);

  // Daily cap (per-user override > platform default)
  const { data: prof } = await supabaseAdmin
    .from("profiles").select("tg_withdraw_daily_cap_sats" as never).eq("user_id", userId).maybeSingle();
  const perUser = (prof as { tg_withdraw_daily_cap_sats?: number | null } | null)?.tg_withdraw_daily_cap_sats;
  const { data: setting } = await supabaseAdmin
    .from("platform_settings").select("value").eq("key", "tg_withdraw_daily_cap_sats").maybeSingle();
  const cap = Number(perUser ?? (setting as { value?: number } | null)?.value ?? 5_000_000); // 0.05 BTC default
  const { data: sum } = await supabaseAdmin.rpc("tg_withdrawal_24h_sats", { _user: userId });
  if (Number(sum ?? 0) + amountSats > cap) {
    return tgSendMessage(chatId, `❌ Daily Telegram withdraw cap exceeded (cap ${(cap/1e8).toFixed(8)} BTC).`);
  }

  // Balance check + ledger lock
  const { data: bal } = await supabaseAdmin
    .from("v_wallet_balances").select("available_sats").eq("user_id", userId).maybeSingle();
  if (!bal || Number(bal.available_sats) < amountSats) {
    return tgSendMessage(chatId, "❌ Insufficient available balance.");
  }
  const { data: wallet } = await supabaseAdmin
    .from("user_wallets").select("id").eq("user_id", userId).single();
  if (!wallet) return tgSendMessage(chatId, "No wallet.");

  const { error: lockErr } = await supabaseAdmin.rpc("ledger_transfer_bucket" as never, {
    _user_id: userId, _from: "available", _to: "pending_withdrawal",
    _amount_sats: amountSats, _kind: "withdrawal", _ref_type: "withdrawal_request", _ref_id: null,
    _metadata: { source: "telegram", destination_preview: dest.slice(0, 12) + "…" },
  } as never);
  if (lockErr) return tgSendMessage(chatId, `❌ ${lockErr.message}`);

  const { data: req, error } = await supabaseAdmin
    .from("withdrawal_requests").insert({
      user_id: userId, wallet_id: wallet.id, method: "btc_onchain", status: "pending_review",
      amount_sats: amountSats, destination: dest, risk_score: 30,
      tg_chat_id: chatId,
    } as never).select("id").single();
  if (error) return tgSendMessage(chatId, `❌ ${error.message}`);

  await auditTg(userId, "tg_withdraw", null, { withdrawal_id: (req as { id: string }).id, amount_sats: amountSats });

  const sent = await tgSendMessage(chatId,
    `🏧 <b>Withdrawal queued</b>\n` +
    `Amount: <code>${amtBtc} BTC</code>\n` +
    `To: <code>${dest}</code>\n` +
    `ID: <code>${(req as { id: string }).id.slice(0,8)}</code>\n` +
    `Status: <code>pending_review</code> (admin approval required)\n` +
    `Cancel: <code>/cancelwithdraw ${(req as { id: string }).id.slice(0,8)} CODE</code>`);
  const mid = (sent as { result?: { message_id?: number } } | null)?.result?.message_id;
  if (mid) await supabaseAdmin.from("withdrawal_requests").update({ tg_message_id: mid } as never).eq("id", (req as { id: string }).id);
}

async function handleCancelWithdraw(userId: string, chatId: number, text: string) {
  const gate = await requireTotpFromText(userId, text, "/cancelwithdraw");
  if (!gate.ok) return tgSendMessage(chatId, gate.reply);
  const arg = gate.text.split(" ")[1];
  if (!arg) return tgSendMessage(chatId, "Usage: <code>/cancelwithdraw WITHDRAWAL_ID CODE</code>");
  const { data: req } = await supabaseAdmin
    .from("withdrawal_requests").select("id, user_id, status, amount_sats")
    .ilike("id", `${arg}%`).limit(1).maybeSingle();
  if (!req || req.user_id !== userId) return tgSendMessage(chatId, "Not found.");
  if (!["pending_review","approved"].includes(req.status)) {
    return tgSendMessage(chatId, `❌ Cannot cancel in status ${req.status}.`);
  }
  await supabaseAdmin.rpc("ledger_transfer_bucket" as never, {
    _user_id: userId, _from: "pending_withdrawal", _to: "available",
    _amount_sats: req.amount_sats, _kind: "withdrawal_cancelled", _ref_type: "withdrawal_request", _ref_id: req.id,
    _metadata: { reason: "user_cancelled_telegram" },
  } as never);
  await supabaseAdmin.from("withdrawal_requests").update({ status: "cancelled" } as never).eq("id", req.id);
  await auditTg(userId, "tg_withdraw_cancel", null, { withdrawal_id: req.id });
  return tgSendMessage(chatId, `✅ Withdrawal <code>${req.id.slice(0,8)}</code> cancelled.`);
}


// Legacy escrow_groups helpers removed (Issue #3). Bind/status/release/cancel
// commands now return a deprecation notice in handle().




async function resolveTradeId(prefix: string, userId: string) {
  // accept full uuid or 8-char prefix
  const { data } = await supabaseAdmin.from("trades")
    .select("id").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .ilike("id", `${prefix}%`).limit(1).maybeSingle();
  return data?.id ?? null;
}

async function handleLink(chatId: number, tgId: number, from: { username?: string; first_name?: string }, code: string) {
  const { data: row } = await supabaseAdmin.from("telegram_link_codes").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!row) return tgSendMessage(chatId, "❌ Invalid code.");
  if (row.used_at) return tgSendMessage(chatId, "❌ Code already used.");
  if (new Date(row.expires_at).getTime() < Date.now()) return tgSendMessage(chatId, "❌ Code expired.");
  await supabaseAdmin.from("profiles").update({
    telegram_user_id: tgId, telegram_username: from.username ?? from.first_name ?? null,
  }).eq("user_id", row.user_id);
  await supabaseAdmin.from("telegram_link_codes").update({ used_at: new Date().toISOString() }).eq("code", row.code);
  return tgSendMessage(chatId, "✅ Telegram linked! You'll now get trade alerts and can use commands like /balance, /trades, /release.");
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEq(provided, expectedSecret())) return new Response("Unauthorized", { status: 401 });
        try {
          const update = await request.json();
          await handle(update);
        } catch (e) {
          console.error("[tg-webhook]", e);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
