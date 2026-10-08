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
        const { verifyWebhookSignature, getInvoicePaymentMethods } = await import("@/lib/btcpay.server");
        if (!verifyWebhookSignature(raw, sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        let evt: BTCPayWebhook;
        try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
        if (!evt?.type || !evt?.invoiceId) {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const deliveryId = evt.deliveryId ?? evt.originalDeliveryId ?? null;
        const payloadJson = JSON.parse(JSON.stringify(evt));
        const nextStatus = mapStatus(evt.type);

        // Audit every webhook receipt (non-idempotent log; safe to repeat).
        await supabaseAdmin.from("escrow_events").insert({
          trade_id: null,
          invoice_id: null,
          kind: "webhook_received",
          payload: payloadJson,
        });

        // Pull live confirmations + totals once (used by both branches).
        let confirmations = 0;
        let paidBtc = 0;
        let lightningPaymentHash: string | null = null;
        try {
          const pms = await getInvoicePaymentMethods(evt.invoiceId);
          confirmations = pms.flatMap((p) => p.payments ?? []).reduce(
            (m, p) => Math.max(m, p.confirmations ?? 0), 0,
          );
          paidBtc = pms.reduce((s, p) => s + Number(p.totalPaid ?? 0), 0);
          // Lightning payment hash: BTCPay returns it as the payment id for BTC-LN method,
          // and the bolt11 invoice destination for the LN payment method.
          const lnMethod = pms.find((p) => /LN|LIGHTNING/i.test(p.paymentMethod ?? ""));
          if (lnMethod) {
            const firstPayment = (lnMethod.payments ?? [])[0];
            lightningPaymentHash = firstPayment?.id ?? lnMethod.destination ?? null;
          }
        } catch (e) {
          console.warn("[btcpay-webhook] pm fetch", e);
        }
        const paidSats = Math.round(paidBtc * 100_000_000);

        // ---- Branch 0: Telegram group escrow deal ----
        {
          const { onTgDealPayment } = await import("@/lib/telegram/group-escrow.server");
          if (await onTgDealPayment(evt.invoiceId, nextStatus, paidBtc, confirmations)) {
            return Response.json({ ok: true, tg: true });
          }
        }

        // ---- Branch 1: trade-bound escrow invoice ----
        const { data: row } = await supabaseAdmin
          .from("escrow_invoices")
          .select("id, trade_id, status")
          .eq("btcpay_invoice_id", evt.invoiceId)
          .maybeSingle();

        if (row) {
          // Atomic: idempotency dedupe + status update + ledger credit + audit + event.
          // (Issue #1 race-safe, Issue #4 always-ledgered escrow funding.)
          const { data: result, error: rpcErr } = await supabaseAdmin.rpc(
            "settle_escrow_invoice_atomic" as never,
            {
              _invoice_id: row.id,
              _paid_sats: paidSats,
              _confirmations: confirmations,
              _paid_btc: paidBtc,
              _next_status: nextStatus ?? "",
              _delivery_id: deliveryId,
              _webhook_id: evt.webhookId ?? null,
              _event_type: evt.type,
              _btcpay_invoice_id: evt.invoiceId,
              _payload: payloadJson,
            } as never,
          );
          if (rpcErr) {
            console.error("[btcpay-webhook] settle_escrow_invoice_atomic failed", rpcErr);
            return new Response("internal error", { status: 500 });
          }
          const settled = (result as { replay?: boolean }) ?? {};
          if (settled.replay) {
            return Response.json({ ok: true, replay: true });
          }

          // Trade lifecycle hooks + notifications (non-fund movement).
          try {
            const { notifyUser } = await import("@/lib/notify.server");
            const { data: trade } = await supabaseAdmin
              .from("trades").select("id, buyer_id, seller_id, status")
              .eq("id", row.trade_id).maybeSingle();
            if (trade) {
              const link = `/trade/${trade.id}`;
              const fire = async (
                kind: Parameters<typeof notifyUser>[0]["kind"],
                title: string, body: string,
              ) => {
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
                  `${confirmations}/3 confirmations · ${paidBtc.toFixed(8)} BTC received.`);
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

          return Response.json({ ok: true, kind: "escrow_invoice", result });
        }

        // ---- Branch 2: wallet deposit_request ----
        const { data: dep } = await supabaseAdmin
          .from("deposit_requests")
          .select("id, user_id, method")
          .eq("btcpay_invoice_id", evt.invoiceId)
          .maybeSingle();
        if (!dep) return Response.json({ ok: true, unknown_invoice: true });

        // Atomic: idempotency dedupe + lock + status + ledger credit + audit.
        const { data: result, error: rpcErr } = await supabaseAdmin.rpc(
          "settle_deposit_atomic" as never,
          {
            _deposit_id: dep.id,
            _paid_sats: paidSats,
            _confirmations: confirmations,
            _next_status: nextStatus ?? "",
            _delivery_id: deliveryId,
            _webhook_id: evt.webhookId ?? null,
            _event_type: evt.type,
            _invoice_id: evt.invoiceId,
            _payload: payloadJson,
            _payment_hash: dep.method === "lightning" ? lightningPaymentHash : null,
          } as never,
        );
        if (rpcErr) {
          console.error("[btcpay-webhook] settle_deposit_atomic failed", rpcErr);
          return new Response("internal error", { status: 500 });
        }
        const out = (result as { replay?: boolean; credited?: boolean }) ?? {};
        if (out.replay) return Response.json({ ok: true, replay: true });

        if (out.credited) {
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

        return Response.json({ ok: true, kind: "wallet_deposit", result });
      },
    },
  },
});
