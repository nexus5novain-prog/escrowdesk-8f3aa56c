import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SATS_PER_BTC = 100_000_000;
// Anything ≥ $500 USD requires admin approval before payout
const APPROVAL_THRESHOLD_USD = 500;

async function btcUsd(): Promise<number> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json() as { bitcoin?: { usd?: number } };
    return j.bitcoin?.usd ?? 0;
  } catch { return 0; }
}

export const listMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("withdrawal_requests")
      .select("id, method, status, amount_sats, fee_sats, destination, risk_score, approved_at, rejected_reason, tx_hash, payment_hash, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

const WithdrawalSchema = z.object({
  method: z.enum(["btc_onchain", "lightning"]),
  amount_sats: z.number().int().positive(),
  destination: z.string().min(10).max(2000),
});

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WithdrawalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Account checks
    const { data: profile } = await context.supabase
      .from("profiles").select("is_banned").eq("user_id", context.userId).single();
    if (profile?.is_banned) throw new Error("Account is suspended");

    const { data: wallet } = await context.supabase
      .from("user_wallets").select("id, is_frozen").eq("user_id", context.userId).single();
    if (!wallet) throw new Error("No wallet");
    if (wallet.is_frozen) throw new Error("Wallet is frozen");

    // 2. Balance check (via view, RLS-scoped)
    const { data: bal } = await context.supabase
      .from("v_wallet_balances")
      .select("available_sats")
      .eq("user_id", context.userId).single();
    if (!bal || Number(bal.available_sats) < data.amount_sats) {
      throw new Error("Insufficient available balance");
    }

    // 3. Risk score (very simple heuristic — Phase 4 will harden)
    const rate = await btcUsd();
    const usd = (data.amount_sats / SATS_PER_BTC) * rate;
    let risk = 0;
    if (usd >= APPROVAL_THRESHOLD_USD) risk += 30;
    if (usd >= 2000) risk += 30;
    if (data.method === "btc_onchain" && !/^(bc1|[13])/i.test(data.destination)) risk += 40;

    const requiresApproval = usd >= APPROVAL_THRESHOLD_USD;
    const status = requiresApproval ? "pending_review" : "approved";

    // 4. Move sats from available -> pending_withdrawal (locks the funds)
    const { error: lockErr } = await supabaseAdmin.rpc("ledger_transfer_bucket" as never, {
      _user_id: context.userId,
      _from: "available",
      _to: "pending_withdrawal",
      _amount_sats: data.amount_sats,
      _kind: "withdrawal",
      _ref_type: "withdrawal_request",
      _ref_id: null,
      _metadata: { method: data.method, destination_preview: data.destination.slice(0, 12) + "…" },
    } as never);
    if (lockErr) throw new Error(lockErr.message);

    // 5. Create the request row
    const { data: req, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        user_id: context.userId,
        wallet_id: wallet.id,
        method: data.method,
        status,
        amount_sats: data.amount_sats,
        destination: data.destination,
        risk_score: risk,
        approved_at: requiresApproval ? null : new Date().toISOString(),
      } as never)
      .select().single();
    if (error) throw error;

    await supabaseAdmin.rpc("wallet_audit" as never, {
      _user_id: context.userId, _action: "withdrawal_requested",
      _ref_type: "withdrawal_request", _ref_id: (req as { id: string }).id,
      _risk_score: risk, _payload: { method: data.method, amount_sats: data.amount_sats, usd },
    } as never);

    return { id: (req as { id: string }).id, status, requires_approval: requiresApproval, risk_score: risk };
  });

// User-initiated cancel (refunds pending_withdrawal -> available)
export const cancelWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req } = await context.supabase
      .from("withdrawal_requests")
      .select("id, user_id, status, amount_sats")
      .eq("id", data.id).single();
    if (!req || req.user_id !== context.userId) throw new Error("Not found");
    if (!["pending_review", "approved"].includes(req.status)) {
      throw new Error("Cannot cancel a withdrawal in status " + req.status);
    }

    await supabaseAdmin.rpc("ledger_transfer_bucket" as never, {
      _user_id: context.userId,
      _from: "pending_withdrawal",
      _to: "available",
      _amount_sats: req.amount_sats,
      _kind: "withdrawal_cancelled",
      _ref_type: "withdrawal_request",
      _ref_id: req.id,
      _metadata: { reason: "user_cancelled" },
    } as never);
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "cancelled" } as never)
      .eq("id", req.id);

    await supabaseAdmin.rpc("wallet_audit" as never, {
      _user_id: context.userId, _action: "withdrawal_cancelled",
      _ref_type: "withdrawal_request", _ref_id: req.id,
    } as never);
    return { ok: true };
  });
