import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type WalletBalance = {
  confirmedBalance?: string | number;
  unconfirmedBalance?: string | number;
};
type LnBalance = {
  balance?: string | number;
  local?: { balance?: string | number };
  remote?: { balance?: string | number };
};

async function fetchBtcPrice(): Promise<number> {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
      signal: AbortSignal.timeout(5000),
    });
    const j = await r.json() as { bitcoin?: { usd?: number } };
    return j.bitcoin?.usd ?? 0;
  } catch { return 0; }
}

async function btcpayStore<T>(path: string): Promise<T | null> {
  const url = process.env.BTCPAY_URL?.replace(/\/$/, "");
  const key = process.env.BTCPAY_API_KEY;
  const store = process.env.BTCPAY_STORE_ID;
  if (!url || !key || !store) return null;
  try {
    const r = await fetch(`${url}/api/v1/stores/${store}${path}`, {
      headers: { Authorization: `token ${key}` },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return null;
    return await r.json() as T;
  } catch (e) {
    console.warn("[btcpay] balance fetch failed", path, e);
    return null;
  }
}

export const getLivePortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Internal wallet snapshot (RLS scoped to caller)
    const { data: wallets } = await context.supabase
      .from("wallets").select("asset, available, escrow").eq("user_id", context.userId);
    const btcWallet = wallets?.find((w) => w.asset === "BTC");

    // Aggregate escrow exposure for this user via escrow_invoices joined to trades
    const { data: openTrades } = await context.supabase
      .from("trades")
      .select("id, crypto_amount, status")
      .or(`buyer_id.eq.${context.userId},seller_id.eq.${context.userId}`)
      .in("status", ["awaiting_agreement", "awaiting_seller_confirm", "pending_payment", "paid"]);
    const open_escrow_btc = (openTrades ?? []).reduce((s, t) => s + Number(t.crypto_amount ?? 0), 0);

    // Live BTCPay-side balances (store-wide; admin/treasury view)
    const [onchain, lightning, rate] = await Promise.all([
      btcpayStore<WalletBalance>("/payment-methods/onchain/BTC/wallet"),
      btcpayStore<LnBalance>("/lightning/BTC/balance"),
      fetchBtcPrice(),
    ]);

    const onchain_confirmed = Number(onchain?.confirmedBalance ?? 0);
    const onchain_unconfirmed = Number(onchain?.unconfirmedBalance ?? 0);
    const ln_local = Number(lightning?.local?.balance ?? lightning?.balance ?? 0) / 1e8;
    const ln_remote = Number(lightning?.remote?.balance ?? 0) / 1e8;

    const internal_available = Number(btcWallet?.available ?? 0);
    const internal_escrow = Number(btcWallet?.escrow ?? 0);
    const total_btc = internal_available + internal_escrow;

    return {
      btc_usd_rate: rate,
      internal: {
        available: internal_available,
        escrow: internal_escrow,
        total: total_btc,
        usd_value: total_btc * rate,
      },
      onchain: {
        confirmed: onchain_confirmed,
        unconfirmed: onchain_unconfirmed,
        usd_value: (onchain_confirmed + onchain_unconfirmed) * rate,
        available: onchain !== null,
      },
      lightning: {
        local_balance: ln_local,
        remote_balance: ln_remote,
        usd_value: ln_local * rate,
        available: lightning !== null,
      },
      open_escrow_btc,
      open_escrow_usd: open_escrow_btc * rate,
      updated_at: new Date().toISOString(),
    };
  });
