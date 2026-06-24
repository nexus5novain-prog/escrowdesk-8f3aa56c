import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AuthGate } from "@/components/AuthGate";
import { LivePortfolio } from "@/components/wallet/LivePortfolio";
import { ParticleBackground } from "@/components/ParticleBackground";
import { MediatorBot } from "@/components/MediatorBot";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMyTrades, createOffer, getCompanyEscrowAddresses } from "@/lib/escrow.functions";
import { THREAD_SECTIONS } from "@/lib/thread-categories";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { fmtCrypto, fmtFiat } from "@/lib/format";
import { toast } from "sonner";
import {
  Plus, ArrowRight, ArrowLeft, Lock, ListChecks, Scale, Wallet as WalletIcon,
  Handshake, AlertTriangle, CheckCircle2, Clock, ShoppingBag, Search,
  ShieldCheck, Zap, FileSignature, Bitcoin, Bot, Eye, Gavel, Server, KeyRound, Activity,
} from "lucide-react";

export const Route = createFileRoute("/escrow")({
  head: () => ({
    meta: [
      { title: "Escrow — EscrowDesk · Bitcoin Escrow & Arbitration" },
      { name: "description", content: "Open a ledger-backed Bitcoin escrow. Live balances, active trades, locked funds, mediated arbitration — all on one page." },
      { property: "og:title", content: "EscrowDesk — Bitcoin Escrow & Arbitration" },
      { property: "og:description", content: "Custodial vault. Internal ledger. Human + bot arbitration. Built for serious counter-parties." },
    ],
  }),
  component: () => (<AuthGate><EscrowPage /></AuthGate>),
});

const ACTIVE_STATUSES = new Set([
  "awaiting_agreement", "awaiting_deposit", "awaiting_seller_confirm",
  "pending_payment", "paid", "disputed",
]);

function EscrowPage() {
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
    <div className="space-y-8">
      {/* HERO — moved from portfolio */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-6 sm:p-10">
        <ParticleBackground color="#f7931a" density={60} linkDistance={130} />
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
              <Bot className="h-3.5 w-3.5" /> EscrowDesk · Mediated Trust
            </div>
            <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
              Trade with anyone.<br />
              <span className="text-primary">Trust the machine.</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              EscrowDesk holds Bitcoin in a custodial treasury until both parties confirm the deal.
              If something goes wrong, our arbitration bot triages the dispute and human judges
              issue signed, on-record verdicts. No private keys to lose. No counter-party risk.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#new-escrow"><Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Start a new escrow</Button></a>
              <Link to="/trades"><Button size="sm" variant="outline"><ListChecks className="mr-1 h-3.5 w-3.5" /> All trades</Button></Link>
              <Link to="/disputes"><Button size="sm" variant="ghost"><Scale className="mr-1 h-3.5 w-3.5" /> Disputes</Button></Link>
              <Link to="/wallet"><Button size="sm" variant="ghost"><WalletIcon className="mr-1 h-3.5 w-3.5" /> Wallet</Button></Link>
            </div>
          </div>
          <MediatorBot className="hidden lg:block" />
        </div>
      </section>

      {/* Live wallet panel */}
      <LivePortfolio />

      {/* Stat tiles — live escrow state */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile icon={<Handshake className="h-4 w-4 text-primary" />} label="Active" value={String(active.length)} />
        <StatTile icon={<Lock className="h-4 w-4 text-orange-500" />} label="Locked (BTC)" value={fmtCrypto(totalLocked, "BTC")} />
        <StatTile icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} label="Disputed" value={String(disputed.length)} />
        <StatTile icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Completed" value={String(released.length)} />
      </div>

      {/* CENTER — the previous "Create escrow" form, now wired to ledger-backed offers */}
      <section id="new-escrow" className="flex justify-center">
        <NewEscrowForm />
      </section>

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
            <><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></>
          ) : active.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No active escrows. <a href="#new-escrow" className="text-primary hover:underline">Start one</a>.
            </div>
          ) : (
            active.slice(0, 8).map((t) => (
              <Link key={t.id} to="/trade/$id" params={{ id: t.id }}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/60">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.status} />
                    <span className="font-mono text-xs text-muted-foreground">#{t.id.slice(0, 8)}</span>
                    <span className="text-xs text-muted-foreground">· {t.buyer_id === user?.id ? "you buy" : "you sell"}</span>
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

      {/* HOW IT WORKS — moved from portfolio */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How EscrowDesk works</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Four steps. Fully internal — no on-chain transfers between counter-parties.
        </p>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} icon={<Handshake className="h-5 w-5" />} title="Agree terms" body="Both parties sign exact terms inside the trade chat — legally meaningful, audit-logged, immutable." />
          <Step n={2} icon={<Lock className="h-5 w-5" />} title="Lock funds" body="Buyer funds escrow from their internal balance. Sats move from `available` → `locked_escrow` instantly." />
          <Step n={3} icon={<FileSignature className="h-5 w-5" />} title="Deliver & confirm" body="Seller delivers off-platform. Buyer confirms receipt; 24/7 arbitration available if they don't." />
          <Step n={4} icon={<Zap className="h-5 w-5" />} title="Release" body="Funds settle into seller's available balance. Withdraw on-chain or via Lightning, anytime." />
        </ol>
      </Card>

      {/* TRUST — moved from portfolio */}
      <section>
        <h2 className="text-lg font-semibold">Why it's safe</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same primitives that secure exchanges, applied to peer-to-peer escrow.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Why icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />} title="Custodial vault" body="Private keys live in EscrowDesk's hardened BTCPay + LND treasury. Users never sign a transaction." />
          <Why icon={<Scale className="h-5 w-5 text-blue-500" />} title="Arbitration first" body="Disputes go to a panel — bot triage, then mediator, judge, and appeal. Decisions are signed and on-record." />
          <Why icon={<Bitcoin className="h-5 w-5 text-orange-500" />} title="Bitcoin native" body="Deposit & withdraw on-chain or via Lightning. Treasury custody is reconciled hourly against the internal ledger." />
          <Why icon={<Eye className="h-5 w-5 text-violet-500" />} title="Append-only ledger" body="Every sat movement is an immutable ledger entry. Balances are a view over entries — they cannot be edited." />
          <Why icon={<Gavel className="h-5 w-5 text-amber-500" />} title="Dual-admin payouts" body="Withdrawals ≥ $2,000 require two independent admin approvals before broadcast. Every action is audited." />
          <Why icon={<KeyRound className="h-5 w-5 text-rose-500" />} title="User-side hardening" body="Per-user withdrawal limits, address whitelists, trusted devices, scoped API tokens, and a full security feed." />
        </div>
      </section>

      {/* INFRA — moved from portfolio */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold">Infrastructure</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <Info label="Settlement layer" body="BTCPay Server (on-chain) + LND (Lightning) — operated by EscrowDesk treasury." />
          <Info label="Source of truth" body="Postgres ledger. Append-only entries; balances derived from a view." />
          <Info label="Reconciliation" body="Hourly automated check that ledger sums match wallet buckets across every account." />
        </div>
      </Card>

      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-center text-xs text-muted-foreground">
        <Activity className="mx-auto mb-2 h-4 w-4 text-primary" />
        Need a counter-party? Browse open offers on the{" "}
        <Link to="/order-book" className="text-primary hover:underline">Order Book</Link>.
      </div>

      <SupportForm />
    </div>
  );
}

/* ---------------- Center form: ledger-backed "New escrow" (post an offer) ---------------- */

function NewEscrowForm() {
  const nav = useNavigate();
  const fn = useServerFn(createOffer);
  const getAddrs = useServerFn(getCompanyEscrowAddresses);
  const { data: company } = useQuery({
    queryKey: ["company-escrow-addrs"],
    queryFn: () => getAddrs(),
    staleTime: 60_000,
  });

  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    side: "sell" as "buy" | "sell",
    amount_btc: "0.05",
    price: "65000",
    payment_method: "onchain" as "onchain" | "lightning",
    counterparty_username: "",
    counterparty_telegram: "",
    terms: "",
  });

  const amt = Number(f.amount_btc) || 0;
  const px = Number(f.price) || 0;
  const fiatTotal = amt * px;
  const isSeller = f.side === "sell";
  const companyAddr = f.payment_method === "onchain" ? (company?.btc_address ?? "") : (company?.lightning_address ?? "");
  const railLabel = f.payment_method === "onchain" ? "On-chain BTC" : "Lightning";

  // Light client-side validation of the company address
  const addrLooksValid = (() => {
    const v = companyAddr.trim();
    if (!v) return false;
    if (f.payment_method === "onchain") {
      // Loose BTC checks: bech32, P2SH, legacy
      return /^(bc1|tb1)[0-9a-z]{8,}$/i.test(v) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(v);
    }
    // Lightning: address (user@host) or bolt11 invoice
    return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(v) || /^ln(bc|tb)[0-9a-z]+$/i.test(v);
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amt <= 0 || px <= 0) { toast.error("Enter a valid amount and price"); return; }
    if (!f.counterparty_username.trim()) { toast.error("Enter the counterparty's username"); return; }
    if (!companyAddr) { toast.error(`Admin has not configured a company ${railLabel} address yet`); return; }
    if (!addrLooksValid) { toast.error(`Company ${railLabel} address looks invalid — ask admin to update it`); return; }

    setBusy(true);
    try {
      const meta = [
        `Role: ${isSeller ? "Seller (receives payout)" : "Buyer (deposits funds)"}`,
        `Counterparty: @${f.counterparty_username.trim().replace(/^@/, "")}`,
        f.counterparty_telegram.trim() ? `Counterparty Telegram: @${f.counterparty_telegram.trim().replace(/^@/, "")}` : "",
        `Rail: ${railLabel}`,
        `Company ${railLabel} address: ${companyAddr}`,
        f.terms.trim() ? `\nTerms:\n${f.terms.trim()}` : "",
      ].filter(Boolean).join("\n");

      const res = await fn({ data: {
        side: f.side,
        asset: "BTC",
        fiat_currency: "USD",
        price: px,
        min_amount: fiatTotal,
        max_amount: fiatTotal,
        available_crypto: amt,
        payment_method_types: [f.payment_method],
        terms: meta,
      }});
      toast.success("Escrow offer published");
      nav({ to: "/offer/$id", params: { id: res.id } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const depositor = isSeller ? "the buyer" : "you";
  const receiver = isSeller ? "you" : "the seller";

  return (
    <Card className="w-full max-w-2xl border-primary/30 bg-card/80 p-6 shadow-lg backdrop-blur">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <Plus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Start a new escrow</h2>
          <p className="text-xs text-muted-foreground">Pick your role, invite the counterparty, and confirm the company payout rail.</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Role toggle */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Your role</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setF({ ...f, side: "sell" })}
              className={`rounded-lg border p-4 text-left transition-all ${isSeller ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-border/60 bg-background/40 hover:border-primary/40"}`}>
              <div className="flex items-center gap-2">
                <ShoppingBag className={`h-4 w-4 ${isSeller ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-semibold">I am a seller</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Buyer deposits to EscrowDesk. I receive the BTC payout once they confirm delivery.</p>
            </button>
            <button type="button" onClick={() => setF({ ...f, side: "buy" })}
              className={`rounded-lg border p-4 text-left transition-all ${!isSeller ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-border/60 bg-background/40 hover:border-primary/40"}`}>
              <div className="flex items-center gap-2">
                <Search className={`h-4 w-4 ${!isSeller ? "text-primary" : "text-muted-foreground"}`} />
                <span className="font-semibold">I am a buyer</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">I deposit BTC to the EscrowDesk address now. Released to the seller after I accept delivery.</p>
            </button>
          </div>
        </div>

        {/* Invite counterparty */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-4">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Invite the {isSeller ? "buyer" : "seller"}
          </Label>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Username on EscrowDesk</Label>
              <Input className="mt-1" value={f.counterparty_username}
                onChange={(e) => setF({ ...f, counterparty_username: e.target.value })}
                placeholder={isSeller ? "buyer_username" : "seller_username"} />
            </div>
            <div>
              <Label className="text-xs">Telegram <span className="text-muted-foreground">(optional, for faster response)</span></Label>
              <Input className="mt-1" value={f.counterparty_telegram}
                onChange={(e) => setF({ ...f, counterparty_telegram: e.target.value })}
                placeholder="@their_handle" />
            </div>
          </div>
        </div>

        {/* Amount + price */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount (BTC)</Label>
            <Input className="mt-1" inputMode="decimal" value={f.amount_btc}
              onChange={(e) => setF({ ...f, amount_btc: e.target.value })} placeholder="0.05" />
          </div>
          <div>
            <Label>Price per BTC (USD)</Label>
            <Input className="mt-1" inputMode="decimal" value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="65000" />
          </div>
        </div>

        {/* Payment method picker */}
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Payment rail</Label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setF({ ...f, payment_method: "onchain" })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all ${f.payment_method === "onchain" ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/40"}`}>
              <Bitcoin className="h-4 w-4 text-orange-500" /><span className="font-medium">On-chain BTC</span>
            </button>
            <button type="button" onClick={() => setF({ ...f, payment_method: "lightning" })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all ${f.payment_method === "lightning" ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/40"}`}>
              <Zap className="h-4 w-4 text-yellow-400" /><span className="font-medium">Lightning</span>
            </button>
          </div>

          {/* Company address (conditional) */}
          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Company {railLabel} address
            </Label>
            {companyAddr ? (
              <p className={`mt-1 break-all font-mono text-xs ${addrLooksValid ? "text-foreground" : "text-rose-500"}`}>{companyAddr}</p>
            ) : (
              <p className="mt-1 text-xs text-rose-500">
                Not configured. An admin must set the company {railLabel} address in Admin → Settings before this escrow can be funded.
              </p>
            )}
            {companyAddr && !addrLooksValid && (
              <p className="mt-1 text-[11px] text-rose-500">This address doesn't look like a valid {railLabel} destination.</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div>
          <Label>Terms (optional)</Label>
          <Textarea className="mt-1" rows={3} value={f.terms}
            onChange={(e) => setF({ ...f, terms: e.target.value })}
            placeholder="What's being delivered, deadlines, refund policy…" />
        </div>

        {/* Dynamic escrow instructions */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <ShieldCheck className="h-4 w-4" /> Escrow flow
          </div>
          <ol className="mt-2 space-y-1.5 text-muted-foreground">
            <li><span className="font-mono text-primary">1.</span> {isSeller ? "Buyer" : "You"} deposit{isSeller ? "s" : ""} <span className="font-mono text-foreground">{fmtCrypto(amt, "BTC")}</span> (~{fmtFiat(fiatTotal, "USD")}) via {railLabel} to the company address above.</li>
            <li><span className="font-mono text-primary">2.</span> EscrowDesk locks the funds and notifies {isSeller ? "you (seller)" : "the seller"} to deliver.</li>
            <li><span className="font-mono text-primary">3.</span> {isSeller ? "Seller (you)" : "Seller"} delivers the goods / service off-platform.</li>
            <li><span className="font-mono text-primary">4.</span> {isSeller ? "Buyer" : "You"} accept{isSeller ? "s" : ""} delivery → EscrowDesk releases the BTC payout to {receiver}.</li>
          </ol>
          <p className="mt-3 text-[11px]">
            Net: <span className="text-foreground">{depositor}</span> deposit{isSeller ? "s" : ""}, <span className="text-foreground">{receiver}</span> receive{isSeller ? "s" : ""} the payout.
          </p>
        </div>

        <Button type="submit" disabled={busy || !companyAddr || !addrLooksValid} className="w-full">
          {busy ? "Publishing…" : <><Handshake className="mr-2 h-4 w-4" /> Publish escrow offer</>}
        </Button>
      </form>
    </Card>
  );
}

/* ---------------- small presentational helpers ---------------- */

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">{icon} {label}</div>
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
  const Icon = status === "disputed" ? AlertTriangle : status === "released" ? CheckCircle2 : Clock;
  return (
    <Badge variant="secondary" className={`h-5 gap-1 px-1.5 text-[10px] ${tone}`}>
      <Icon className="h-3 w-3" /> {status.replace(/_/g, " ")}
    </Badge>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="relative rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-2 text-primary">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 font-mono text-xs">{n}</span>
        {icon}
      </div>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </li>
  );
}

function Why({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="p-5">
      <div>{icon}</div>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </Card>
  );
}

function Info({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs">{body}</p>
    </div>
  );
}
