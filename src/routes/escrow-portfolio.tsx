import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { ParticleBackground } from "@/components/ParticleBackground";
import { getLivePortfolio } from "@/lib/wallet-live.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bitcoin, Zap, Lock, ShieldCheck, ArrowRight, Activity } from "lucide-react";
import { fmtFiat } from "@/lib/format";

export const Route = createFileRoute("/escrow-portfolio")({
  component: () => (<AuthGate><EscrowPortfolio /></AuthGate>),
});

function useCountUp(value: number, duration = 900) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const from = v;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return v;
}

function EscrowPortfolio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(getLivePortfolio);
  const { data: live } = useQuery({
    queryKey: ["live-portfolio"], queryFn: () => fn(), refetchInterval: 20_000,
  });

  // User's escrow invoices
  const { data: invoices } = useQuery({
    queryKey: ["my-escrow-invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("escrow_invoices")
        .select("id, trade_id, status, amount_btc, paid_amount_btc, confirmations, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`escrow-portfolio-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "escrow_invoices" },
        () => qc.invalidateQueries({ queryKey: ["my-escrow-invoices", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const totalUsd = useCountUp(live?.open_escrow_usd ?? 0);
  const activeCount = (invoices ?? []).filter((i) => i.status === "new" || i.status === "processing").length;
  const settledCount = (invoices ?? []).filter((i) => i.status === "settled").length;
  const totalVolBtc = (invoices ?? []).reduce((s, i) => s + Number(i.amount_btc ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero with particle bg */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-6 sm:p-10">
        <ParticleBackground color="#f7931a" density={70} linkDistance={140} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-emerald-500" /> Escrow Portfolio · Live
          </div>
          <h1 className="mt-3 font-mono text-4xl font-bold sm:text-5xl">
            {fmtFiat(totalUsd, "USD")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Total value locked across your active escrow trades, updated in real-time from BTCPay & LND.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/escrow/new"><Button size="sm">New escrow group <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
            <Link to="/trades"><Button size="sm" variant="outline">View trades</Button></Link>
            <Link to="/wallet"><Button size="sm" variant="outline">Wallet</Button></Link>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Lock className="h-4 w-4 text-primary" />} label="In escrow" value={(live?.open_escrow_btc ?? 0).toFixed(8)} suffix="BTC" />
        <StatCard icon={<Activity className="h-4 w-4 text-emerald-500" />} label="Active invoices" value={String(activeCount)} />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-blue-500" />} label="Settled" value={String(settledCount)} />
        <StatCard icon={<Bitcoin className="h-4 w-4 text-orange-500" />} label="Volume" value={totalVolBtc.toFixed(8)} suffix="BTC" />
      </div>

      {/* Recent invoices */}
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Recent escrow activity
        </h2>
        {(invoices ?? []).length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No escrow invoices yet. Open a trade to generate Bitcoin payment destinations.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {(invoices ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2.5">
                <Link to="/trade/$id" params={{ id: i.trade_id }} className="flex items-center gap-3 hover:underline">
                  <StatusDot status={i.status} />
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      #{i.trade_id.slice(0, 8)}
                    </p>
                    <p className="font-mono text-sm">{Number(i.amount_btc).toFixed(8)} BTC</p>
                  </div>
                </Link>
                <div className="text-right">
                  <Badge variant="secondary" className="text-[10px] uppercase">{i.status}</Badge>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {i.confirmations}/3 conf
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <Card className="relative overflow-hidden p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
        {value} {suffix && <span className="text-xs font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-muted-foreground",
    processing: "bg-yellow-500 animate-pulse",
    settled: "bg-emerald-500",
    expired: "bg-red-500",
    invalid: "bg-red-600",
  };
  return <span className={`h-2.5 w-2.5 rounded-full ${map[status] ?? "bg-muted"}`} />;
}
