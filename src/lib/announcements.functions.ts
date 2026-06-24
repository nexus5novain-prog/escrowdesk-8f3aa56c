import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public: read currently active announcements for the banner.
export const listActiveAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const supa = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supa
    .from("announcements")
    .select("id, title, body, link, published_at")
    .eq("is_active", true)
    .order("published_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(error.message);
  return { announcements: data ?? [] };
});

async function assertStaff(supabase: ReturnType<typeof createClient<Database>>, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r) => ["admin", "moderator"].includes(r.role as string));
  if (!ok) throw new Error("Forbidden");
}

export const adminListAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { data, error } = await context.supabase
      .from("announcements")
      .select("id, title, body, link, is_active, published_at, created_at")
      .order("published_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { announcements: data ?? [] };
  });

export const adminCreateAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      body: z.string().trim().min(2).max(4000),
      link: z.string().url().optional().or(z.literal("")),
      broadcast_inapp: z.boolean().default(true),
      broadcast_telegram: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ann, error } = await supabaseAdmin
      .from("announcements")
      .insert({
        title: data.title, body: data.body, link: data.link || null,
        created_by: context.userId, is_active: true,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, telegram_user_id");
    let sent = 0;
    if (data.broadcast_inapp || data.broadcast_telegram) {
      const { tgSendMessage } = await import("@/lib/telegram.server");
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      for (const p of profs ?? []) {
        const row = p as { user_id: string; telegram_user_id: number | null };
        if (data.broadcast_inapp) {
          await admin.from("notifications").insert({
            user_id: row.user_id, kind: "system" as never,
            title: data.title, body: data.body, link: data.link || null,
          }).then(() => { sent++; }).catch(() => null);
        }
        if (data.broadcast_telegram && row.telegram_user_id) {
          await tgSendMessage(row.telegram_user_id, `<b>${escapeHtml(data.title)}</b>\n${escapeHtml(data.body)}${data.link ? `\n${data.link}` : ""}`).catch(() => null);
        }
      }
    }
    return { ok: true, id: ann.id, notified: sent };
  });

export const adminToggleAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
