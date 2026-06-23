import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ tradeId: z.string().uuid() });

export const createEscrowInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trade, error: tErr } = await supabase
      .from("trades")
      .select("id, buyer_id, seller_id, crypto_amount, asset, status")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (tErr || !trade) throw new Error("Trade not found");
    if (trade.buyer_id !== userId && trade.seller_id !== userId) throw new Error("Not a participant");
    if (trade.asset !== "BTC") throw new Error("Only BTC supported");

    // Reuse if already created and still usable
    const { data: existing } = await supabase
      .from("escrow_invoices")
      .select("*")
      .eq("trade_id", data.tradeId)
      .maybeSingle();
    if (existing && existing.status !== "expired" && existing.status !== "invalid") {
      return existing;
    }

    const { createInvoice, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inv = await createInvoice({
      amountBtc: Number(trade.crypto_amount),
      tradeId: trade.id,
      buyerId: trade.buyer_id,
    });
    const pms = await getInvoicePaymentMethods(inv.id);
    const onchain = pms.find((p) => p.paymentMethod === "BTC-CHAIN" || p.paymentMethod === "BTC");
    const lightning = pms.find((p) => p.paymentMethod === "BTC-LN" || p.paymentMethod === "BTC_LightningLike");

    const row = {
      trade_id: trade.id,
      btcpay_invoice_id: inv.id,
      bitcoin_address: onchain?.destination ?? null,
      lightning_invoice: lightning?.destination ?? null,
      amount_btc: Number(trade.crypto_amount),
      status: "new" as const,
      expires_at: inv.expirationTime ? new Date(inv.expirationTime * 1000).toISOString() : null,
    };

    const { data: saved, error: sErr } = await supabaseAdmin
      .from("escrow_invoices")
      .upsert(row, { onConflict: "trade_id" })
      .select("*")
      .single();
    if (sErr) throw sErr;

    await supabaseAdmin.from("escrow_events").insert({
      trade_id: trade.id,
      invoice_id: saved.id,
      kind: "created",
      payload: { btcpay_invoice_id: inv.id },
    });

    return saved;
  });

export const getEscrowInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("escrow_invoices")
      .select("*")
      .eq("trade_id", data.tradeId)
      .maybeSingle();
    return row;
  });

export const refreshEscrowInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("escrow_invoices")
      .select("*")
      .eq("trade_id", data.tradeId)
      .maybeSingle();
    if (!existing) throw new Error("No invoice");

    const { getInvoice, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inv = await getInvoice(existing.btcpay_invoice_id);
    const pms = await getInvoicePaymentMethods(existing.btcpay_invoice_id);
    const confs = pms.flatMap((p) => p.payments ?? []).reduce(
      (max, p) => Math.max(max, p.confirmations ?? 0), 0,
    );
    const totalPaid = pms.reduce((s, p) => s + Number(p.totalPaid ?? 0), 0);
    const nextStatus = mapStatus(inv.status);

    const { data: updated } = await supabaseAdmin
      .from("escrow_invoices")
      .update({
        status: nextStatus,
        confirmations: confs,
        paid_amount_btc: totalPaid,
        settled_at: nextStatus === "settled" ? new Date().toISOString() : existing.settled_at,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return updated;
  });

function mapStatus(s?: string): "new" | "processing" | "settled" | "expired" | "invalid" {
  switch ((s ?? "").toLowerCase()) {
    case "new": return "new";
    case "processing": return "processing";
    case "settled":
    case "complete":
    case "confirmed": return "settled";
    case "expired": return "expired";
    case "invalid": return "invalid";
    default: return "new";
  }
}
