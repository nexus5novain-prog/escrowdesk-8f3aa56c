import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ticketSchema = z.object({
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(4000),
});

// Public: anyone can submit a support ticket. Notifies all staff in-app + Telegram.
export const createSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ticketSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({ email: data.email, subject: data.subject, message: data.message })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Notify all staff
    const { data: staff } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "moderator", "support"] as never);
    const ids = Array.from(new Set((staff ?? []).map((r) => r.user_id)));
    if (ids.length) {
      const { notifyUser } = await import("@/lib/notify.server");
      await Promise.all(
        ids.map((uid) =>
          notifyUser({
            userId: uid,
            kind: "system",
            title: `New support ticket: ${data.subject}`,
            body: `From ${data.email} — ${data.message.slice(0, 140)}`,
            link: `/admin?tab=support&id=${row.id}`,
          }).catch(() => null),
        ),
      );
    }
    return { ok: true, id: row.id };
  });

export const listSupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator", "support"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("support_tickets")
      .select("id, email, subject, message, status, admin_response, responded_at, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

export const respondToSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      response: z.string().trim().min(1).max(4000),
      status: z.enum(["responded", "closed"]).default("responded"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isStaff = (roles ?? []).some((r) => ["admin", "moderator", "support"].includes(r.role as string));
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .update({
        admin_response: data.response,
        responded_by: context.userId,
        responded_at: new Date().toISOString(),
        status: data.status,
      })
      .eq("id", data.id)
      .select("user_id, email, subject")
      .single();
    if (error) throw new Error(error.message);

    if (ticket?.user_id) {
      const { notifyUser } = await import("@/lib/notify.server");
      await notifyUser({
        userId: ticket.user_id,
        kind: "system",
        title: `Support reply: ${ticket.subject}`,
        body: data.response.slice(0, 280),
        link: `/settings`,
      });
    }
    return { ok: true };
  });
