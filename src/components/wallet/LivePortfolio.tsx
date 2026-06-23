import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bitcoin, Zap, Lock, RefreshCw, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLivePortfolio } from "@/lib/wallet-live.functions";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtFiat, fmtCrypto } from "@/lib/format";

function useCountUp(value: number, duration = 800) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const from = v;
    const to = value;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return v;
}

export function LivePortfolio() {
  const fn = useServerFn(getLivePortfolio);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["live-portfolio"],
    queryFn: () => fn(),
    refetchInterval: 20_000,
  });

  // Live invalidate on wallet/escrow row changes for this user
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`portfolio-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["live-portfolio"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "escrow_invoices" },
        () => qc.invalidateQueries({ queryKey: ["live-portfolio"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const totalUsd = useCountUp(data?.internal.usd_value ?? 0);

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-3 h-12 w-72" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Live Portfolio</p>
          </div>
          <h2 className="mt-2 font-mono text-4xl font-bold tabular-nums">
            {fmtFiat(totalUsd, "USD")}
          </h2>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {fmtCrypto(data?.internal.total ?? 0, "BTC")} ·
            <span className="ml-1">1 BTC = {fmtFiat(data?.btc_usd_rate ?? 0, "USD")}</span>
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <BalanceTile
          icon={<Bitcoin className="h-4 w-4 text-orange-500" />}
          label="On-chain (BTCPay)"
          btc={data?.onchain.confirmed ?? 0}
          subBtc={data?.onchain.unconfirmed ?? 0}
          subLabel="pending"
          usd={data?.onchain.usd_value ?? 0}
          available={data?.onchain.available ?? false}
        />
        <BalanceTile
          icon={<Zap className="h-4 w-4 text-yellow-400" />}
          label="Lightning"
          btc={data?.lightning.local_balance ?? 0}
          subBtc={data?.lightning.remote_balance ?? 0}
          subLabel="inbound"
          usd={data?.lightning.usd_value ?? 0}
          available={data?.lightning.available ?? false}
        />
        <BalanceTile
          icon={<Lock className="h-4 w-4 text-primary" />}
          label="In escrow (yours)"
          btc={data?.internal.escrow ?? 0}
          subBtc={data?.open_escrow_btc ?? 0}
          subLabel="active trades"
          usd={(data?.internal.escrow ?? 0) * (data?.btc_usd_rate ?? 0)}
          available
        />
      </div>

      <p className="mt-4 text-[10px] text-muted-foreground">
        Updated {data ? new Date(data.updated_at).toLocaleTimeString() : "—"} · refreshes every 20s
      </p>
    </Card>
  );
}

function BalanceTile({
  icon, label, btc, subBtc, subLabel, usd, available,
}: {
  icon: React.ReactNode; label: string; btc: number; subBtc: number; subLabel: string; usd: number; available: boolean;
}) {
  const v = useCountUp(btc);
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        {available ? (
          <Badge variant="secondary" className="h-5 bg-emerald-500/15 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">live</Badge>
        ) : (
          <Badge variant="secondary" className="h-5 bg-muted px-1.5 text-[10px]">offline</Badge>
        )}
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tabular-nums">{v.toFixed(8)} <span className="text-xs text-muted-foreground">BTC</span></p>
      <p className="mt-0.5 text-xs text-muted-foreground">{fmtFiat(usd, "USD")}</p>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        {subBtc > 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3" />}
        {subBtc.toFixed(8)} BTC <span>{subLabel}</span>
      </p>
    </div>
  );
}
