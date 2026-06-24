import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin → send a private note to one, many, or all users as an in-app notification
// (with optional Telegram fan-out). "Email toggle" maps to Telegram here because
// Lovable Emails is not yet configured.
export const adminSendUserMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      body: z.string().trim().min(2).max(4000),
      link: z.string().url().optional().or(z.literal("")),
      target: z.enum(["all", "selected"]),
      user_ids: z.array(z.string().uuid()).max(5000).optional(),
      also_telegram: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let recipients: Array<{ user_id: string; telegram_user_id: number | null }> = [];
    if (data.target === "all") {
      const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, telegram_user_id");
      recipients = (profs ?? []) as never;
    } else {
      const ids = data.user_ids ?? [];
      if (!ids.length) throw new Error("Pick at least one user");
      const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, telegram_user_id").in("user_id", ids);
      recipients = (profs ?? []) as never;
    }

    const { tgSendMessage } = await import("@/lib/telegram.server");
    let sent = 0;
    for (const r of recipients) {
      await supabaseAdmin.from("notifications").insert({
        user_id: r.user_id, kind: "system" as never,
        title: data.title, body: data.body, link: data.link || null,
      }).then(() => { sent++; }).catch(() => null);
      if (data.also_telegram && r.telegram_user_id) {
        await tgSendMessage(r.telegram_user_id, `<b>${escape(data.title)}</b>\n${escape(data.body)}${data.link ? `\n${data.link}` : ""}`).catch(() => null);
      }
    }
    return { ok: true, recipients: sent };
  });

export const adminListUsersLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");
    const { data } = await context.supabase
      .from("profiles").select("user_id, display_name, telegram_username").order("display_name").limit(500);
    return { users: data ?? [] };
  });

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
