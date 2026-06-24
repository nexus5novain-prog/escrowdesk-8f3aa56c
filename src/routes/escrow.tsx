import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGate } from "@/components/AuthGate";
import { LivePortfolio } from "@/components/wallet/LivePortfolio";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyTrades } from "@/lib/escrow.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtCrypto, fmtFiat } from "@/lib/format";
import {
  Plus, ArrowRight, Lock, ListChecks, Scale, Wallet as WalletIcon,
  Handshake, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";

export const Route = createFileRoute("/escrow")({
  head: () => ({
    meta: [
      { title: "Escrow Dashboard · EscrowDesk" },
      { name: "description", content: "Your live escrow operations: balances, active trades, locked funds and quick actions." },
    ],
  }),
  component: () => (<AuthGate><EscrowDashboard /></AuthGate>),
});

const ACTIVE_STATUSES = new Set([
  "awaiting_agreement", "awaiting_deposit", "awaiting_seller_confirm",
  "pending_payment", "paid", "disputed",
]);

function EscrowDashboard() {
  const fn = useServerFn(getMyTrades);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-trades-dash"],
    queryFn: () => fn(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`trades-dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" },
        () => qc.invalidateQueries({ queryKey: ["my-trades-dash"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const trades = data?.trades ?? [];
  const active = trades.filter((t) => ACTIVE_STATUSES.has(t.status));
  const disputed = trades.filter((t) => t.status === "disputed");
  const released = trades.filter((t) => t.status === "released");
  const totalLocked = active.reduce((s, t) => s + Number(t.crypto_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary">Escrow · Operations</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Escrow Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live balances, active escrows, and quick actions. Read about how it works on the{" "}
            <Link to="/portfolio" className="text-primary hover:underline">platform page</Link>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/escrow/new"><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> New escrow</Button></Link>
          <Link to="/trades"><Button size="sm" variant="outline"><ListChecks className="mr-1 h-3.5 w-3.5" /> All trades</Button></Link>
          <Link to="/disputes"><Button size="sm" variant="outline"><Scale className="mr-1 h-3.5 w-3.5" /> Disputes</Button></Link>
          <Link to="/wallet"><Button size="sm" variant="ghost"><WalletIcon className="mr-1 h-3.5 w-3.5" /> Wallet</Button></Link>
        </div>
      </div>

      {/* Live balances panel */}
      <LivePortfolio />

      {/* Stat tiles */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile icon={<Handshake className="h-4 w-4 text-primary" />} label="Active" value={String(active.length)} />
        <StatTile icon={<Lock className="h-4 w-4 text-orange-500" />} label="Locked (BTC)" value={fmtCrypto(totalLocked, "BTC")} />
        <StatTile icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Disputed" value={String(disputed.length)} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Completed" value={String(released.length)} />
      </div>

      {/* Active escrows */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Active escrows</h2>
            <p className="text-xs text-muted-foreground">Trades currently holding funds or awaiting action.</p>
          </div>
          <Link to="/trades" className="text-xs text-primary hover:underline">All trades →</Link>
        </div>

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
            </>
          ) : active.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No active escrows. <Link to="/escrow/new" className="text-primary hover:underline">Start one</Link>.
            </div>
          ) : (
            active.slice(0, 8).map((t) => (
              <Link
                key={t.id}
                to="/trade/$id"
                params={{ id: t.id }}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <span className="font-mono text-xs text-muted-foreground">
                      #{t.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {t.buyer_id === user?.id ? "you buy" : "you sell"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-sm">
                    {fmtCrypto(Number(t.crypto_amount), t.asset)} ·{" "}
                    <span className="text-muted-foreground">{fmtFiat(Number(t.fiat_amount), "USD")}</span>
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-2 font-mono text-xl font-bold tabular-nums">{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "disputed" ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
      : status === "paid" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : status === "released" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : status === "cancelled" ? "bg-muted text-muted-foreground"
      : "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  const Icon = status === "disputed" ? AlertTriangle
    : status === "released" ? CheckCircle2
    : Clock;
  return (
    <Badge variant="secondary" className={`h-5 gap-1 px-1.5 text-[10px] ${tone}`}>
      <Icon className="h-3 w-3" />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
