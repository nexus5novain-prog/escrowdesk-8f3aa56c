import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getMyTrades } from "@/lib/escrow.functions";
import { fmtCrypto, fmtFiat, shortId } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, XCircle, Clock, Handshake } from "lucide-react";
import { motion } from "framer-motion";
import { AdBanner } from "@/components/AdBanner";
import { PortfolioHero } from "@/components/PortfolioHero";
import { TradesSubNav } from "@/components/TradesSubNav";

export const Route = createFileRoute("/trades")({
  head: () => ({ meta: [{ title: "Trades — EscrowDesk" }] }),
  component: () => (<AuthGate><Trades /></AuthGate>),
});

type StatusBucket = "open" | "pending" | "successful" | "failed";

function bucketOf(status: string): StatusBucket {
  if (status === "released") return "successful";
  if (status === "cancelled" || status === "disputed") return "failed";
  if (status === "awaiting_agreement" || status === "awaiting_deposit" || status === "awaiting_seller_confirm") return "pending";
  return "open";
}

function Trades() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fn = useServerFn(getMyTrades);
  const { data } = useQuery({
    queryKey: ["my-trades"],
    queryFn: () => fn(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`trades-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trades" }, () => {
        qc.invalidateQueries({ queryKey: ["my-trades"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["my-trades"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const trades = data?.trades ?? [];
  const stats = useMemo(() => {
    const s = { open: 0, pending: 0, successful: 0, failed: 0 };
    for (const t of trades) {
      const b = bucketOf(String(t.status));
      s[b] += 1;
    }
    return s;
  }, [trades]);
  const active = trades.filter((t) => !["released", "cancelled"].includes(String(t.status)));
  const history = trades.filter((t) => ["released", "cancelled"].includes(String(t.status)));

  const cards: { key: StatusBucket; label: string; value: number; icon: React.ReactNode; tone: string }[] = [
    { key: "open", label: "Open trades", value: stats.open, icon: <Activity className="h-4 w-4" />, tone: "text-primary" },
    { key: "successful", label: "Successful", value: stats.successful, icon: <CheckCircle2 className="h-4 w-4" />, tone: "text-emerald-500" },
    { key: "failed", label: "Failed", value: stats.failed, icon: <XCircle className="h-4 w-4" />, tone: "text-destructive" },
    { key: "pending", label: "Pending", value: stats.pending, icon: <Clock className="h-4 w-4" />, tone: "text-amber-500" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PortfolioHero
        eyebrow="Escrow trades"
        title="Your escrow activity"
        subtitle="Every ledger-backed trade you've opened or joined — live status, counterparties and outcomes."
        icon={Handshake}
        gradient="from-emerald-500/25 via-primary/15 to-sky-500/20"
        stats={[
          { label: "Open", value: stats.open, icon: Activity, accent: "primary" },
          { label: "Pending", value: stats.pending, icon: Clock, accent: "amber" },
          { label: "Successful", value: stats.successful, icon: CheckCircle2, accent: "emerald" },
          { label: "Failed", value: stats.failed, icon: XCircle, accent: "rose" },
        ]}
      />
      <div className="flex items-center justify-end gap-2">
        <Link to="/transactions"><Badge variant="outline" className="cursor-pointer gap-1">View in portfolio →</Badge></Link>
        <Link to="/order-book"><Badge className="cursor-pointer gap-1"><Handshake className="h-3 w-3" /> New trade</Badge></Link>
      </div>

      <AdBanner placement="trades_escrow" variant="banner" />

      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <motion.div
            key={c.key}
            layout
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="surface p-3 sm:p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <span className={c.tone}>{c.icon}</span>
            </div>
            <motion.div
              key={c.value}
              initial={{ scale: 0.9, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
              className="mt-2 font-mono text-2xl sm:text-3xl font-semibold"
            >{c.value}</motion.div>
            <div className="mt-1 h-1 w-full rounded-full bg-secondary/40 overflow-hidden">
              <div className={`h-full ${c.tone.replace("text-", "bg-")} opacity-60`} style={{ width: `${Math.min(100, c.value * 8)}%` }} />
            </div>
          </motion.div>
        ))}
      </div>

      <section className="surface overflow-hidden">
        <header className="flex items-center justify-between border-b border-border/40 px-3 sm:px-5 py-3">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider">Active escrow trades</h2>
          <span className="font-mono text-[10px] sm:text-xs text-muted-foreground">{active.length} active</span>
        </header>
        <div className="divide-y divide-border/40 overflow-x-auto">
          {active.map((t) => {
            const b = bucketOf(String(t.status));
            const tone = b === "successful" ? "text-emerald-500" : b === "failed" ? "text-destructive" : b === "pending" ? "text-amber-500" : "text-primary";
            const role = t.buyer_id === user?.id ? "buyer" : "seller";
            return (
              <Link
                key={t.id}
                to="/trade/$id"
                params={{ id: t.id }}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 px-3 sm:px-5 py-3 transition-colors hover:bg-secondary/30 min-h-[60px]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <span className="font-mono text-xs sm:text-sm">{shortId(t.id)}</span>
                    <Badge variant="outline" className={`uppercase text-[10px] ${tone}`}>{String(t.status).replace(/_/g, " ")}</Badge>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">· {role}</span>
                  </div>
                  <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="font-mono text-xs sm:text-sm">{fmtCrypto(Number(t.crypto_amount), t.asset)}</div>
                  {t.fiat_amount != null && (
                    <div className="font-mono text-[11px] sm:text-xs text-muted-foreground">{fmtFiat(Number(t.fiat_amount), "USD")}</div>
                  )}
                </div>
              </Link>
            );
          })}
          {active.length === 0 && (
            <div className="p-6 sm:p-10 text-center text-sm text-muted-foreground">
              No active trades. <Link to="/marketplace" className="text-primary underline">Browse the marketplace</Link> or <Link to="/order-book" className="text-primary underline">open the order book</Link>.
            </div>
          )}
        </div>
      </section>

      {history.length > 0 && (
        <section className="surface">
          <header className="flex items-center justify-between border-b border-border/40 px-5 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider">History</h2>
          </header>
          <div className="divide-y divide-border/40">
            {history.map((t) => (
              <Link key={t.id} to="/trade/$id" params={{ id: t.id }} className="flex items-center justify-between px-5 py-2.5 text-sm hover:bg-secondary/20">
                <span className="font-mono text-xs">{shortId(t.id)}</span>
                <span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                <span className="font-mono text-xs">{fmtCrypto(Number(t.crypto_amount), t.asset)}</span>
                <Badge variant="outline" className="text-[10px] uppercase">{String(t.status)}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
