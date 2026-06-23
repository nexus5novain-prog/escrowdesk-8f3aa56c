import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ShoutMsg = {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  status: "pending" | "approved" | "rejected";
  payment_method: "wallet" | "btc" | null;
  payment_txid: string | null;
  paid_amount_usd: number | null;
  created_at: string;
  is_pinned?: boolean;
  is_hidden?: boolean;
  report_count?: number;
  avatar_url?: string | null;
  is_premium?: boolean;
  is_trusted?: boolean;
};

// Rate limits (lenient — chosen by user)
const COOLDOWN_SECONDS = 5 * 60;
const DAILY_LIMIT = 20;

async function isStaff(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "moderator"]).maybeSingle();
  return !!data;
}

async function getFeeUsd(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("platform_settings").select("value").eq("key", "shoutbox_fee_usd").maybeSingle();
  const raw = (data?.value as unknown) ?? 5;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

async function enforceRateLimit(userId: string) {
  // Daily count
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: dayCount } = await supabaseAdmin
    .from("shoutbox_messages").select("id", { head: true, count: "exact" })
    .eq("user_id", userId).gte("created_at", dayAgo);
  if ((dayCount ?? 0) >= DAILY_LIMIT) {
    throw new Error(`Daily limit reached (${DAILY_LIMIT} posts / 24h). Try again later.`);
  }
  // Cooldown
  const { data: last } = await supabaseAdmin
    .from("shoutbox_messages").select("created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (last?.created_at) {
    const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < COOLDOWN_SECONDS) {
      const wait = Math.ceil(COOLDOWN_SECONDS - elapsed);
      throw new Error(`Please wait ${Math.ceil(wait / 60)} min before posting again.`);
    }
  }
}

export const getShoutboxConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("platform_settings").select("key,value").in("key", ["shoutbox_btc_address", "shoutbox_fee_usd"]);
  const rows = data ?? [];
  const addrRaw = rows.find((r) => r.key === "shoutbox_btc_address")?.value;
  const feeRaw = rows.find((r) => r.key === "shoutbox_fee_usd")?.value;
  const btc_address = typeof addrRaw === "string" ? addrRaw : (addrRaw == null ? "" : String(addrRaw));
  const fee_usd = Number(feeRaw ?? 5) || 5;
  return { btc_address, fee_usd, cooldown_seconds: COOLDOWN_SECONDS, daily_limit: DAILY_LIMIT };
});

export const listApprovedShouts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional().transform((v) => v ?? { limit: 30 }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("shoutbox_messages")
      .select("id,user_id,display_name,body,status,payment_method,payment_txid,paid_amount_usd,created_at,is_pinned,is_hidden,report_count")
      .eq("status", "approved").eq("is_hidden", false)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const profs = ids.length
      ? (await supabaseAdmin.from("profiles").select("user_id,avatar_url,is_premium,is_trusted").in("user_id", ids)).data ?? []
      : [];
    const pm = new Map(profs.map((p) => [p.user_id, p]));
    const messages: ShoutMsg[] = (rows ?? []).map((r) => ({
      ...(r as Omit<ShoutMsg, "avatar_url" | "is_premium" | "is_trusted">),
      avatar_url: pm.get(r.user_id)?.avatar_url ?? null,
      is_premium: pm.get(r.user_id)?.is_premium ?? false,
      is_trusted: pm.get(r.user_id)?.is_trusted ?? false,
    }));
    return { messages };
  });

export const postShoutWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ body: z.string().trim().min(1).max(500) }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await enforceRateLimit(userId);
    const fee = await getFeeUsd();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("display_name,is_banned").eq("user_id", userId).maybeSingle();
    if (prof?.is_banned) throw new Error("Account banned");
    const { error: debitErr } = await supabaseAdmin.rpc("debit_wallet", {
      _user: userId, _asset: "USDT", _amount: fee, _note: "Shoutbox post fee",
    });
    if (debitErr) throw new Error(debitErr.message);
    const display = prof?.display_name || "anon";
    const { data: row, error } = await supabaseAdmin.from("shoutbox_messages").insert({
      user_id: userId, display_name: display, body: data.body,
      status: "approved", payment_method: "wallet", paid_amount_usd: fee,
      reviewed_at: new Date().toISOString(),
    }).select("id").single();
    if (error) {
      await supabaseAdmin.rpc("credit_wallet", { _user: userId, _asset: "USDT", _amount: fee, _note: "Shoutbox refund" });
      throw new Error(error.message);
    }
    return { id: row.id, status: "approved" as const };
  });

export const postShoutWithBTC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    body: z.string().trim().min(1).max(500),
    txid: z.string().trim().min(6).max(200),
  }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await enforceRateLimit(userId);
    const fee = await getFeeUsd();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("display_name,is_banned").eq("user_id", userId).maybeSingle();
    if (prof?.is_banned) throw new Error("Account banned");
    const display = prof?.display_name || "anon";
    const { data: row, error } = await supabaseAdmin.from("shoutbox_messages").insert({
      user_id: userId, display_name: display, body: data.body,
      status: "pending", payment_method: "btc", payment_txid: data.txid, paid_amount_usd: fee,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id, status: "pending" as const };
  });

export const reportShout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.string().trim().min(1).max(500) }))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("shoutbox_reports").insert({
      message_id: data.id, reporter_id: context.userId, reason: data.reason,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const adminListShouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.enum(["pending","approved","rejected","all"]).default("pending") }).optional().transform((v) => v ?? { status: "pending" as const }))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("Staff only");
    let q = supabaseAdmin
      .from("shoutbox_messages")
      .select("id,user_id,display_name,body,status,payment_method,payment_txid,paid_amount_usd,created_at,is_pinned,is_hidden,report_count")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }).limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []) as ShoutMsg[] };
  });

export const adminReviewShout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), action: z.enum(["approve","reject"]) }))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("Staff only");
    const { error } = await supabaseAdmin.from("shoutbox_messages").update({
      status: data.action === "approve" ? "approved" : "rejected",
      reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminTogglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), pinned: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("Staff only");
    const { error } = await supabaseAdmin.from("shoutbox_messages")
      .update({ is_pinned: data.pinned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleHide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), hidden: z.boolean() }))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("Staff only");
    const { error } = await supabaseAdmin.from("shoutbox_messages")
      .update({ is_hidden: data.hidden }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetShoutboxBtc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ btc_address: z.string().trim().max(120), fee_usd: z.number().min(0.01).max(1000).optional() }))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.userId))) throw new Error("Staff only");
    await supabaseAdmin.from("platform_settings").upsert({ key: "shoutbox_btc_address", value: data.btc_address }, { onConflict: "key" });
    if (data.fee_usd != null) {
      await supabaseAdmin.from("platform_settings").upsert({ key: "shoutbox_fee_usd", value: data.fee_usd }, { onConflict: "key" });
    }
    return { ok: true };
  });
