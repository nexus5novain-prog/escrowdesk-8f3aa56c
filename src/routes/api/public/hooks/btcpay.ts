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

        // Idempotency: dedupe by BTCPay delivery id. Replays return the cached result.
        const deliveryId = evt.deliveryId ?? evt.originalDeliveryId ?? null;
        if (deliveryId) {
          const { data: prior } = await supabaseAdmin
            .from("webhook_deliveries" as never)
            .select("id, result")
            .eq("source", "btcpay")
            .eq("delivery_id", deliveryId)
            .maybeSingle();
          if (prior) {
            return Response.json({ ok: true, replay: true, result: (prior as { result: unknown }).result });
          }
        }

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

        // Not an escrow invoice? Try user-wallet deposit_request
        if (!row) {
          const { data: dep } = await supabaseAdmin
            .from("deposit_requests")
            .select("id, user_id, wallet_id, method, status, amount_sats")
            .eq("btcpay_invoice_id", evt.invoiceId)
            .maybeSingle();
          if (!dep) return Response.json({ ok: true, unknown_invoice: true });

          // Fetch live amounts/confs
          let conf = 0, paidBtc = 0;
          try {
            const pms = await getInvoicePaymentMethods(evt.invoiceId);
            conf = pms.flatMap((p) => p.payments ?? []).reduce((m, p) => Math.max(m, p.confirmations ?? 0), 0);
            paidBtc = pms.reduce((s, p) => s + Number(p.totalPaid ?? 0), 0);
          } catch (e) { console.warn("[wallet-dep] pm fetch", e); }
          const paidSats = Math.round(paidBtc * 100_000_000);
          const nextDepStatus = mapStatus(evt.type);

          await supabaseAdmin.from("deposit_requests").update({
            confirmations: conf,
            status: nextDepStatus === "processing" ? "detected"
                  : nextDepStatus === "settled" ? "settled"
                  : nextDepStatus === "expired" ? "expired"
                  : nextDepStatus === "invalid" ? "invalid"
                  : dep.status,
            detected_at: nextDepStatus === "processing" ? new Date().toISOString() : undefined,
            settled_at: nextDepStatus === "settled" ? new Date().toISOString() : undefined,
          } as never).eq("id", dep.id);

          if (nextDepStatus === "settled" && dep.status !== "settled" && paidSats > 0) {
            // Credit user's available balance via the ledger
            await supabaseAdmin.rpc("ledger_credit" as never, {
              _user_id: dep.user_id,
              _bucket: "available",
              _amount_sats: paidSats,
              _kind: "deposit",
              _ref_type: "deposit_request",
              _ref_id: dep.id,
              _metadata: { method: dep.method, btcpay_invoice_id: evt.invoiceId },
            } as never);
            await supabaseAdmin.rpc("wallet_audit" as never, {
              _user_id: dep.user_id, _action: "deposit_settled",
              _ref_type: "deposit_request", _ref_id: dep.id,
              _payload: { amount_sats: paidSats, method: dep.method },
            } as never);
            try {
              const { notifyUser } = await import("@/lib/notify.server");
              await notifyUser({
                userId: dep.user_id, kind: "wallet_credit",
                title: "Deposit confirmed",
                body: `${paidBtc.toFixed(8)} BTC credited to your wallet.`,
                link: "/wallet",
              });
            } catch (e) { console.warn("[wallet-dep] notify", e); }
          }
          return Response.json({ ok: true, kind: "wallet_deposit" });
        }


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

        // Notify trade participants
        try {
          const { notifyUser } = await import("@/lib/notify.server");
          const { data: trade } = await supabaseAdmin
            .from("trades").select("id, buyer_id, seller_id, status")
            .eq("id", row.trade_id).maybeSingle();
          if (trade) {
            const link = `/trade/${trade.id}`;
            const fire = async (kind: Parameters<typeof notifyUser>[0]["kind"], title: string, body: string) => {
              await Promise.all([
                notifyUser({ userId: trade.buyer_id, kind, title, body, link }),
                notifyUser({ userId: trade.seller_id, kind, title, body, link }),
              ]);
            };
            if (nextStatus === "new") {
              await fire("escrow_invoice_created", "Escrow invoice ready",
                "Payment destinations generated for your trade.");
            } else if (nextStatus === "processing") {
              await fire("escrow_payment_detected", "Payment detected",
                `${confirmations}/3 confirmations · ${paid.toFixed(8)} BTC received.`);
            } else if (nextStatus === "settled") {
              await fire("escrow_settled", "Escrow funded ✓",
                "Bitcoin payment has settled. Trade advancing.");
            } else if (nextStatus === "expired") {
              await fire("escrow_expired", "Escrow invoice expired",
                "The payment window closed before funds arrived.");
            }
            if (nextStatus === "settled" && trade.status === "awaiting_seller_confirm") {
              await supabaseAdmin.rpc("confirm_buyer_deposit", {
                _trade_id: row.trade_id, _caller: trade.seller_id,
              });
            }
          }
        } catch (e) {
          console.error("[btcpay-webhook] notify/confirm failed", e);
        }

        // Record successful processing for idempotency replay protection.
        if (deliveryId) {
          await supabaseAdmin.from("webhook_deliveries" as never).insert({
            source: "btcpay",
            delivery_id: deliveryId,
            webhook_id: evt.webhookId ?? null,
            event_type: evt.type,
            invoice_id: evt.invoiceId,
            payload: JSON.parse(JSON.stringify(evt)),
            result: { status: nextStatus, confirmations, paid },
          } as never);
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
