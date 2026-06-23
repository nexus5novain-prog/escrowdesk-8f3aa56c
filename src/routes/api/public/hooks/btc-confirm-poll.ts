import { createFileRoute } from "@tanstack/react-router";

/**
 * Polls mempool.space for confirmations on pending BTC shoutbox payments
 * and auto-approves messages once their tx has at least 1 confirmation.
 * Triggered by pg_cron every 2 minutes.
 */
export const Route = createFileRoute("/api/public/hooks/btc-confirm-poll")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pending } = await supabaseAdmin
          .from("shoutbox_messages")
          .select("id, payment_txid")
          .eq("status", "pending")
          .eq("payment_method", "btc")
          .not("payment_txid", "is", null)
          .limit(50);

        const results: Array<{ id: string; txid: string; confirmed: boolean; error?: string }> = [];
        for (const row of pending ?? []) {
          const txid = row.payment_txid as string;
          try {
            const res = await fetch(`https://mempool.space/api/tx/${encodeURIComponent(txid)}/status`);
            if (!res.ok) { results.push({ id: row.id, txid, confirmed: false, error: `status ${res.status}` }); continue; }
            const j = (await res.json()) as { confirmed?: boolean };
            if (j.confirmed) {
              await supabaseAdmin.from("shoutbox_messages").update({
                status: "approved",
                reviewed_at: new Date().toISOString(),
                btc_confirmations: 1,
              }).eq("id", row.id);
              results.push({ id: row.id, txid, confirmed: true });
            } else {
              results.push({ id: row.id, txid, confirmed: false });
            }
          } catch (e) {
            results.push({ id: row.id, txid, confirmed: false, error: (e as Error).message });
          }
        }

        return Response.json({ ok: true, checked: results.length, approved: results.filter((r) => r.confirmed).length, results });
      },
    },
  },
});
