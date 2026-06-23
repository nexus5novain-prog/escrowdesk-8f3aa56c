import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureStaff(supabase: ReturnType<typeof Object>, userId: string) {
  const { data: roles } = await (supabase as never as { from: (t: string) => { select: (c: string) => { eq: (c: string, v: string) => Promise<{ data: { role: string }[] | null }> } } })
    .from("user_roles").select("role").eq("user_id", userId);
  const allowed = new Set(["admin","moderator","judge","finance","support"]);
  const ok = (roles ?? []).some((r) => allowed.has(r.role));
  if (!ok) throw new Error("Forbidden");
}

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum(["pending_review","approved","rejected","processing","sent","failed","cancelled","all"]).default("pending_review"),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    let q = context.supabase.from("withdrawal_requests")
      .select("id, user_id, method, status, amount_sats, fee_sats, destination, risk_score, metadata, approved_by, approved_at, rejected_reason, tx_hash, payment_hash, created_at")
      .order("created_at", { ascending: false }).limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const ids = (rows ?? []).map((r) => r.id);
    const [{ data: profiles }, { data: approvals }] = await Promise.all([
      userIds.length
        ? context.supabase.from("profiles").select("user_id, display_name, is_trusted, is_premium, is_banned").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      ids.length
        ? context.supabase.from("withdrawal_approvals").select("withdrawal_id, admin_id, action, note, created_at").in("withdrawal_id", ids).order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const aMap = new Map<string, typeof approvals>();
    for (const a of approvals ?? []) {
      const arr = aMap.get(a.withdrawal_id) ?? [];
      arr.push(a); aMap.set(a.withdrawal_id, arr);
    }
    return (rows ?? []).map((r) => ({
      ...r,
      profile: pMap.get(r.user_id) ?? null,
      approvals: aMap.get(r.id) ?? [],
    }));
  });

export const adminApproveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_approve_withdrawal" as never, {
      _withdrawal_id: data.id, _admin: context.userId, _note: data.note ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRejectWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), reason: z.string().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_reject_withdrawal" as never, {
      _withdrawal_id: data.id, _admin: context.userId, _reason: data.reason,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminMarkWithdrawalPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    tx_hash: z.string().max(200).optional(),
    payment_hash: z.string().max(200).optional(),
  }).refine((v) => !!(v.tx_hash || v.payment_hash), "tx_hash or payment_hash required").parse(d))
  .handler(async ({ data, context }) => {
    await ensureStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("admin_mark_withdrawal_paid" as never, {
      _withdrawal_id: data.id, _admin: context.userId,
      _tx_hash: data.tx_hash ?? null, _payment_hash: data.payment_hash ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
