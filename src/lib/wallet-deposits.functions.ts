import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SATS_PER_BTC = 100_000_000;

// Get the signed-in user's wallet code + computed balances
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: row } = await context.supabase
      .from("v_wallet_balances")
      .select("wallet_id, wallet_code, available_sats, locked_escrow_sats, pending_deposit_sats, pending_withdrawal_sats")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) {
      // Defensive: trigger should have created the wallet; create on demand
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_wallets").insert({ user_id: context.userId } as never).select().single();
      const { data: row2 } = await context.supabase
        .from("v_wallet_balances")
        .select("wallet_id, wallet_code, available_sats, locked_escrow_sats, pending_deposit_sats, pending_withdrawal_sats")
        .eq("user_id", context.userId)
        .maybeSingle();
      return row2;
    }
    return row;
  });

export const listMyLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("ledger_entries")
      .select("id, kind, direction, bucket, amount_sats, ref_type, ref_id, metadata, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });

export const listMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("deposit_requests")
      .select("id, method, status, amount_sats, destination, payment_hash, confirmations, confirmations_required, expires_at, created_at, settled_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

// Create an on-chain BTC deposit invoice for this user.
// We use a BTCPay invoice (BTC-CHAIN only) — it mints a fresh address bound to the invoice.
export const createBtcDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ amount_sats: z.number().int().positive().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wallet } = await context.supabase
      .from("user_wallets").select("id, wallet_code").eq("user_id", context.userId).single();
    if (!wallet) throw new Error("Wallet missing");

    const amountBtc = data.amount_sats ? data.amount_sats / SATS_PER_BTC : 0.0001; // default min
    const inv = await createUserInvoice(amountBtc, ["BTC-CHAIN"], {
      depositType: "btc_onchain",
      userId: context.userId,
      walletId: wallet.id,
    });
    const pms = await (await import("@/lib/btcpay.server")).getInvoicePaymentMethods(inv.id);
    const onchain = pms.find((p) => p.paymentMethod === "BTC-CHAIN");
    const address = onchain?.destination ?? "";

    const expires = inv.expirationTime
      ? new Date(inv.expirationTime * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: dep, error } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        user_id: context.userId,
        wallet_id: wallet.id,
        method: "btc_onchain",
        amount_sats: data.amount_sats ?? null,
        btcpay_invoice_id: inv.id,
        destination: address,
        expires_at: expires,
        metadata: { invoice_link: inv.checkoutLink },
      } as never)
      .select().single();
    if (error) throw error;

    await supabaseAdmin.rpc("wallet_audit" as never, {
      _user_id: context.userId, _action: "deposit_btc_created",
      _ref_type: "deposit_request", _ref_id: (dep as { id: string }).id,
    } as never);

    return { address, invoice_id: inv.id, checkout_link: inv.checkoutLink, expires_at: expires };
  });

// Create a Lightning invoice (BTC-LN only)
export const createLightningDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ amount_sats: z.number().int().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: wallet } = await context.supabase
      .from("user_wallets").select("id, wallet_code").eq("user_id", context.userId).single();
    if (!wallet) throw new Error("Wallet missing");

    const amountBtc = data.amount_sats / SATS_PER_BTC;
    const inv = await createUserInvoice(amountBtc, ["BTC-LN"], {
      depositType: "lightning",
      userId: context.userId,
      walletId: wallet.id,
    });
    const pms = await (await import("@/lib/btcpay.server")).getInvoicePaymentMethods(inv.id);
    const ln = pms.find((p) => p.paymentMethod === "BTC-LN");
    const bolt11 = ln?.destination ?? "";

    const expires = inv.expirationTime
      ? new Date(inv.expirationTime * 1000).toISOString()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: dep, error } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        user_id: context.userId,
        wallet_id: wallet.id,
        method: "lightning",
        amount_sats: data.amount_sats,
        btcpay_invoice_id: inv.id,
        destination: bolt11,
        expires_at: expires,
        confirmations_required: 0,
        metadata: { invoice_link: inv.checkoutLink },
      } as never)
      .select().single();
    if (error) throw error;

    await supabaseAdmin.rpc("wallet_audit" as never, {
      _user_id: context.userId, _action: "deposit_ln_created",
      _ref_type: "deposit_request", _ref_id: (dep as { id: string }).id,
    } as never);

    return { bolt11, invoice_id: inv.id, checkout_link: inv.checkoutLink, expires_at: expires };
  });

// Helper: tag-aware invoice creator (used by the deposit fns above).
// Kept here (not in btcpay.server.ts) because it adds deposit-specific metadata.
async function createUserInvoice(
  amountBtc: number,
  paymentMethods: ("BTC-CHAIN" | "BTC-LN")[],
  metadata: Record<string, unknown>,
) {
  // Build the request inline so we don't have to change the shared helper signature.
  const url = process.env.BTCPAY_URL?.replace(/\/$/, "");
  const key = process.env.BTCPAY_API_KEY;
  const store = process.env.BTCPAY_STORE_ID;
  if (!url || !key || !store) throw new Error("BTCPay not configured");
  const r = await fetch(`${url}/api/v1/stores/${store}/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `token ${key}` },
    body: JSON.stringify({
      amount: amountBtc.toFixed(8),
      currency: "BTC",
      metadata,
      checkout: { expirationMinutes: 60, paymentMethods },
    }),
  });
  const body = await r.json() as { id: string; checkoutLink?: string; expirationTime?: number };
  if (!r.ok) throw new Error(`BTCPay ${r.status}`);
  return body;
}
