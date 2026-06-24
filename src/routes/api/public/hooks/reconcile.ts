import { createFileRoute } from "@tanstack/react-router";

// pg_cron hits this endpoint with the project anon key in the `apikey` header.
// We re-validate that the apikey matches our publishable key before running.
export const Route = createFileRoute("/api/public/hooks/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("run_reconciliation" as never);
        if (error) {
          console.error("[reconcile] failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
        const runId = data as unknown as string;
        const { data: run } = await supabaseAdmin
          .from("reconciliation_runs" as never)
          .select("status, drift_count, checks_run")
          .eq("id", runId)
          .maybeSingle();
        return Response.json({ ok: true, run_id: runId, run });
      },
    },
  },
});
