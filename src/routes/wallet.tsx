import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMe, updateWalletAddresses, getBadgeProgress, getWalletPnL, getPurchaseHistory } from "@/lib/escrow.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
// removed Select import (BTC-only)
import { ShieldCheck, Crown, Wallet as WalletIcon, Bitcoin, ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { fmtCrypto, fmtFiat } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LivePortfolio } from "@/components/wallet/LivePortfolio";

export const Route = createFileRoute("/wallet")({ component: () => (<AuthGate><Wallet /></AuthGate>) });

const COINS = [
  { key: "btc", label: "BTC", chainLabel: "Bitcoin", placeholder: "Paste your BTC address (bc1… / 3… / 1…)" },
] as const;

function Wallet() {
  const fetchMe = useServerFn(getMe);
  const saveAddrs = useServerFn(updateWalletAddresses);
  const fetchBadges = useServerFn(getBadgeProgress);
  const fetchPnL = useServerFn(getWalletPnL);
  const fetchHistory = useServerFn(getPurchaseHistory);
  const { data, refetch } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const { data: badges } = useQuery({ queryKey: ["badges"], queryFn: () => fetchBadges() });
  const { data: pnl } = useQuery({ queryKey: ["pnl"], queryFn: () => fetchPnL() });
  const { data: historyData } = useQuery({ queryKey: ["purchase-history"], queryFn: () => fetchHistory() });
  const qc = useQueryClient();
  const { user } = useAuth();

  // Live updates: when this user's profile or roles change, refresh badges + me
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["badges"] }); qc.invalidateQueries({ queryKey: ["me"] }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => { qc.invalidateQueries({ queryKey: ["badges"] }); qc.invalidateQueries({ queryKey: ["my-roles", user.id] }); qc.invalidateQueries({ queryKey: ["me"] }); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const [btc, setBtc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = data?.profile as Record<string, string | null> | undefined;
    if (p) setBtc(p.wallet_address_btc ?? "");
  }, [data?.profile]);

  const save = async () => {
    setSaving(true);
    try {
      await saveAddrs({ data: { wallet_address_btc: btc } });
      toast.success("Payout address saved");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Wallet & Earnings</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/escrow/new" className="w-full sm:w-auto"><Button variant="outline" size="sm" className="w-full sm:w-auto">New escrow group</Button></Link>
          <Link to="/post-offer" className="w-full sm:w-auto"><Button variant="outline" size="sm" className="w-full sm:w-auto">Post offer</Button></Link>
        </div>
      </div>

      {/* Live BTC/LN portfolio */}
      <LivePortfolio />

      {/* Earnings PnL */}
      <div className="surface p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-base sm:text-lg">Lifetime activity</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Totals are derived from completed (released) trades only.
        </p>
        <div className="mt-4 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard label="Total earned" value={fmtFiat(pnl?.total_earned_usd ?? 0, "USD")} icon={<ArrowDownRight className="h-4 w-4 text-emerald-400" />} />
          <StatCard label="Total spent"  value={fmtFiat(pnl?.total_spent_usd ?? 0, "USD")} icon={<ArrowUpRight className="h-4 w-4 text-rose-400" />} />
          <StatCard label="Net"           value={fmtFiat(pnl?.net_usd ?? 0, "USD")}          icon={<TrendingUp className="h-4 w-4 text-primary" />} />
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Per-asset PnL</div>
          {(pnl?.per_asset?.length ?? 0) === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
              No completed trades yet. Earnings will appear here after your first released trade.
            </div>
          ) : (
            <div className="grid gap-2 overflow-x-auto">
              {pnl?.per_asset.map((row) => (
                <div key={row.asset} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-border/40 bg-secondary/20 p-3">
                  <Badge variant="outline" className="font-mono w-fit">{row.asset}</Badge>
                  <div className="flex flex-wrap gap-2 sm:gap-6 text-xs">
                    <span className="text-emerald-400">+{fmtCrypto(row.earned, "BTC")}</span>
                    <span className="text-rose-400">−{fmtCrypto(row.spent, "BTC")}</span>
                    <span className="font-mono">net {row.net >= 0 ? "+" : ""}{fmtCrypto(row.net, "BTC")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payout addresses */}
      <div className="surface p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-base sm:text-lg">Add wallet address</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste the on-chain BTC address where coin will be released and accepted after successful trades.
          This address is visible to your trade counterparty inside the trade chat.
        </p>
        <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-1">
          <AddrField label="BTC" icon={<Bitcoin className="h-3.5 w-3.5" />} value={btc} onChange={setBtc} placeholder={COINS[0].placeholder} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">{saving ? "Saving…" : "Save addresses"}</Button>
        </div>
      </div>

      <div className="surface p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-base sm:text-lg">Purchase history</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Your most recent store purchases are shown here so you can revisit product orders and escrow details.</p>
        <div className="mt-4 space-y-3">
          {(historyData?.purchases ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No purchases yet. Buy a product from the marketplace to create an escrow group and track it here.
            </div>
          ) : (
            (historyData?.purchases ?? []).map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 bg-background/80 p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div>
                    <div className="font-semibold text-sm">{item.listing_name || "Marketplace item"}</div>
                    <div className="text-xs text-muted-foreground">{item.listing_category || "Store"}</div>
                  </div>
                  <div className="font-mono text-xs sm:text-sm text-primary">{item.amount} {item.asset}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                  <span>{item.status}</span>
                  <span>•</span>
                  <span>{item.fiat_amount} {item.fiat_currency}</span>
                  <span>•</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BadgeJourney badges={badges} />
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/40 bg-secondary/20 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        {label}{icon}
      </div>
      <div className="mt-1 font-mono text-xl">{value}</div>
    </div>
  );
}

function AddrField({ label, icon, value, onChange, placeholder }: {
  label: string; icon: React.ReactNode; value: string; onChange: (s: string)=>void; placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono" />
    </div>
  );
}

function BadgeJourney({ badges }: { badges?: { is_trusted: boolean; is_premium: boolean; trades_completed: number; distinct_4plus_raters: number; max_repeat_partner: number; btc_volume_usd: number; five_star_count: number } }) {
  const b = badges ?? { is_trusted: false, is_premium: false, trades_completed: 0, distinct_4plus_raters: 0, max_repeat_partner: 0, btc_volume_usd: 0, five_star_count: 0 };
  const trustedSteps = [
    { label: "5 successful trades", cur: b.trades_completed, goal: 5 },
    { label: "5 different 4★+ ratings", cur: b.distinct_4plus_raters, goal: 5 },
    { label: "3 trades with one partner", cur: b.max_repeat_partner, goal: 3 },
    { label: "$500 BTC traded", cur: Math.round(b.btc_volume_usd), goal: 500 },
  ];
  const premiumSteps = [
    { label: "Trusted badge unlocked", cur: b.is_trusted ? 1 : 0, goal: 1 },
    { label: "25 successful trades", cur: b.trades_completed, goal: 25 },
    { label: "15 five-star ratings", cur: b.five_star_count, goal: 15 },
    { label: "$5,000 BTC traded", cur: Math.round(b.btc_volume_usd), goal: 5000 },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BadgeCard title="Trusted badge" icon={<ShieldCheck className="h-4 w-4" />} unlocked={b.is_trusted}
        accentClass="text-emerald-400" intro="Earn your Trusted badge by completing this journey:" steps={trustedSteps} />
      <BadgeCard title="Premium tier" icon={<Crown className="h-4 w-4" />} unlocked={b.is_premium}
        accentClass="text-amber-400" intro="Top-tier verified merchant. Unlock by maintaining excellence:" steps={premiumSteps} />
    </div>
  );
}

function BadgeCard({ title, icon, unlocked, accentClass, intro, steps }: {
  title: string; icon: React.ReactNode; unlocked: boolean; accentClass: string; intro: string;
  steps: { label: string; cur: number; goal: number }[];
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 font-semibold ${accentClass}`}>{icon} {title}</div>
        {unlocked
          ? <Badge className="bg-primary/15 text-primary">Unlocked</Badge>
          : <Badge variant="outline" className="font-mono text-[10px]">In progress</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{intro}</p>
      <ul className="mt-3 space-y-3">
        {steps.map((s) => {
          const pct = Math.min(100, Math.round((s.cur / s.goal) * 100));
          const done = s.cur >= s.goal;
          return (
            <li key={s.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{Math.min(s.cur, s.goal)} / {s.goal}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
