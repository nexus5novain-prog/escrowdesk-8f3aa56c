// Server-only notification dispatcher. Inserts an in-app notification (respecting
// the user's preferences) and optionally sends a Telegram message with a deep link.

import { tgSendMessage } from "@/lib/telegram.server";

export type NotificationKind =
  | "escrow_invoice_created"
  | "escrow_payment_detected"
  | "escrow_settled"
  | "escrow_expired"
  | "trade_signed"
  | "trade_paid"
  | "trade_released"
  | "trade_cancelled"
  | "dispute_opened"
  | "dispute_resolved"
  | "arbitration_update"
  | "wallet_credit"
  | "wallet_debit"
  | "admin_warning"
  | "admin_ban"
  | "system";

const APP_URL = "https://escrowdesk.lovable.app";

export async function notifyUser(args: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  payload?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Read preference + telegram_user_id in one go.
  const [{ data: pref }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("notification_preferences")
      .select("in_app, telegram")
      .eq("user_id", args.userId)
      .eq("kind", args.kind)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("telegram_user_id, display_name")
      .eq("user_id", args.userId)
      .maybeSingle(),
  ]);

  const inAppEnabled = pref?.in_app ?? true;
  const tgEnabled = pref?.telegram ?? true;

  if (inAppEnabled) {
    await supabaseAdmin.from("notifications").insert({
      user_id: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body ?? null,
      link: args.link ?? null,
      payload: (args.payload ?? {}) as never,
    });
  }

  const tgId = (profile as { telegram_user_id?: number | string | null } | null)?.telegram_user_id;
  if (tgEnabled && tgId) {
    const url = args.link ? `${APP_URL}${args.link}` : APP_URL;
    const text =
      `<b>${escapeHtml(args.title)}</b>` +
      (args.body ? `\n${escapeHtml(args.body)}` : "") +
      `\n\n<a href="${url}">Open in EscrowDesk →</a>`;
    try {
      await tgSendMessage(tgId, text, { disable_web_page_preview: true });
    } catch (e) {
      console.warn("[notify] telegram send failed", e);
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
