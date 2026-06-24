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

export const listNewsletterSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");
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
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notifyUser } = await import("@/lib/notify.server");
    const { data: profs } = await supabaseAdmin.from("profiles").select("user_id");
    let sent = 0;
    for (const p of profs ?? []) {
      try {
        await notifyUser({
          userId: (p as { user_id: string }).user_id,
          kind: "system",
          title: data.title,
          body: data.body,
          link: data.link || undefined,
        });
        sent++;
      } catch { /* ignore */ }
    }
    return { ok: true, recipients: sent };
  });
