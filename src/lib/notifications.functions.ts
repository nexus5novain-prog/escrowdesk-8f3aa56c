import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NOTIF_KINDS = [
  "escrow_invoice_created", "escrow_payment_detected", "escrow_settled", "escrow_expired",
  "trade_signed", "trade_paid", "trade_released", "trade_cancelled",
  "dispute_opened", "dispute_resolved", "arbitration_update",
  "wallet_credit", "wallet_debit", "admin_warning", "admin_ban", "system",
] as const;
export type NotificationKind = typeof NOTIF_KINDS[number];
const KindSchema = z.enum(NOTIF_KINDS);

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, kind, title, body, link, payload, read_at, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return { notifications: data ?? [], unread };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", context.userId);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId).is("read_at", null);
    return { ok: true };
  });

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_preferences")
      .select("kind, in_app, telegram")
      .eq("user_id", context.userId);
    const map = new Map((data ?? []).map((r) => [r.kind, r]));
    const prefs = NOTIF_KINDS.map((k) => ({
      kind: k,
      in_app: map.get(k)?.in_app ?? true,
      telegram: map.get(k)?.telegram ?? true,
    }));
    return { prefs };
  });

export const updateNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: KindSchema,
    in_app: z.boolean().optional(),
    telegram: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId,
      kind: data.kind,
      in_app: data.in_app ?? true,
      telegram: data.telegram ?? true,
    } as never, { onConflict: "user_id,kind" });
    return { ok: true };
  });

export const NOTIFICATION_KINDS = NOTIF_KINDS;
