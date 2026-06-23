import { createFileRoute } from "@tanstack/react-router";

type BTCPayWebhook = {
  deliveryId?: string;
  webhookId?: string;
  originalDeliveryId?: string;
  isRedelivery?: boolean;
  type: string;
  timestamp?: number;
  storeId?: string;
  invoiceId?: string;
  metadata?: Record<string, unknown>;
  payment?: { value?: string; status?: string };
};

function mapStatus(t: string): "new" | "processing" | "settled" | "expired" | "invalid" | null {
  switch (t) {
    case "InvoiceCreated": return "new";
    case "InvoiceReceivedPayment":
    case "InvoiceProcessing":
    case "InvoicePaymentSettled": return "processing";
    case "InvoiceSettled": return "settled";
    case "InvoiceExpired": return "expired";
    case "InvoiceInvalid": return "invalid";
    default: return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/btcpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("BTCPay-Sig") ?? request.headers.get("btcpay-sig");
        const { verifyWebhookSignature, getInvoice, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
        if (!verifyWebhookSignature(raw, sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        let evt: BTCPayWebhook;
        try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        if (!evt?.type || !evt?.invoiceId) {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Log every webhook receipt (audit)
        await supabaseAdmin.from("escrow_events").insert({
          trade_id: null,
          invoice_id: null,
          kind: "webhook_received",
          payload: JSON.parse(JSON.stringify(evt)),
        });


        const { data: row } = await supabaseAdmin
          .from("escrow_invoices")
          .select("id, trade_id, status")
          .eq("btcpay_invoice_id", evt.invoiceId)
          .maybeSingle();
        if (!row) return Response.json({ ok: true, unknown_invoice: true });

        // Pull live confirmations + totals
        let confirmations = 0;
        let paid = 0;
        try {
          const pms = await getInvoicePaymentMethods(evt.invoiceId);
          confirmations = pms.flatMap((p) => p.payments ?? []).reduce(
            (max, p) => Math.max(max, p.confirmations ?? 0), 0,
          );
          paid = pms.reduce((s, p) => s + Number(p.totalPaid ?? 0), 0);
        } catch (e) {
          console.warn("[btcpay-webhook] could not fetch payment methods", e);
        }

        const nextStatus = mapStatus(evt.type);
        const update: {
          confirmations: number;
          paid_amount_btc: number;
          status?: "new" | "processing" | "settled" | "expired" | "invalid";
          settled_at?: string;
        } = { confirmations, paid_amount_btc: paid };
        if (nextStatus) update.status = nextStatus;
        if (nextStatus === "settled") update.settled_at = new Date().toISOString();

        await supabaseAdmin.from("escrow_invoices").update(update).eq("id", row.id);


        await supabaseAdmin.from("escrow_events").insert({
          trade_id: row.trade_id,
          invoice_id: row.id,
          kind: kindFromType(evt.type),
          payload: { confirmations, paid, type: evt.type },
        });

        // On settle: advance trade via existing RPC if it's awaiting seller confirm
        if (nextStatus === "settled") {
          try {
            const { data: trade } = await supabaseAdmin
              .from("trades")
              .select("id, seller_id, status")
              .eq("id", row.trade_id)
              .maybeSingle();
            if (trade && trade.status === "awaiting_seller_confirm") {
              await supabaseAdmin.rpc("confirm_buyer_deposit", {
                _trade_id: row.trade_id,
                _caller: trade.seller_id,
              });
            }
          } catch (e) {
            console.error("[btcpay-webhook] confirm_buyer_deposit failed", e);
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});

function kindFromType(t: string): string {
  switch (t) {
    case "InvoiceCreated": return "created";
    case "InvoiceReceivedPayment": return "detected";
    case "InvoiceProcessing": return "confirmed";
    case "InvoicePaymentSettled": return "confirmed";
    case "InvoiceSettled": return "settled";
    case "InvoiceExpired": return "expired";
    case "InvoiceInvalid": return "invalid";
    default: return "webhook";
  }
}
