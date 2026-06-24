import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      source: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .upsert(
        { email: data.email.toLowerCase(), source: data.source ?? "footer", unsubscribed_at: null },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertStaff(context: { supabase: ReturnType<typeof requireSupabaseAuth> extends never ? never : any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("role").eq("user_id", context.userId);
  const isStaff = (data ?? []).some((r: { role: string }) => ["admin", "moderator"].includes(r.role));
  if (!isStaff) throw new Error("Forbidden");
}

export const listNewsletterSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("newsletter_subscribers")
      .select("id, email, source, subscribed_at, unsubscribed_at")
      .order("subscribed_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { subscribers: data ?? [] };
  });

export const broadcastNewsletter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(200),
      body: z.string().trim().min(2).max(4000),
      link: z.string().url().optional().or(z.literal("")),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Newsletter goes to: (a) every signed-in user as in-app notification, (b) every linked Telegram.
    const { data: profs } = await supabaseAdmin.from("profiles").select("user_id, telegram_user_id");
    const { notifyUser } = await link();
    let sent = 0;
    for (const p of profs ?? []) {
      await notifyUser({
        userId: (p as { user_id: string }).user_id,
        kind: "system",
        title: data.title,
        body: data.body,
        link: data.link || undefined,
      }).catch(() => null);
      sent++;
    }
    return { ok: true, recipients: sent };
  });

async function link() {
  return await import("@/lib/notify.server");
}
