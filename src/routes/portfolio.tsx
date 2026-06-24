import { createFileRoute, Link } from "@tanstack/react-router";
import { ParticleBackground } from "@/components/ParticleBackground";
import { MediatorBot } from "@/components/MediatorBot";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Lock, Zap, Scale, FileSignature, Handshake, ArrowRight,
  Bitcoin, Bot, Eye, Gavel, Server, KeyRound, Activity,
} from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "EscrowDesk — Bitcoin Escrow & Arbitration Platform" },
      { name: "description", content: "EscrowDesk is a custodial Bitcoin escrow with on-chain & Lightning rails, mediated arbitration, and an immutable ledger. Trade with anyone — trust the machine." },
      { property: "og:title", content: "EscrowDesk — Bitcoin Escrow & Arbitration" },
      { property: "og:description", content: "Custodial vault. Internal ledger. Human + bot arbitration. Built for serious counter-parties." },
    ],
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  return (
    <div className="space-y-8">
      {/* Hero with animated mediator bot */}
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
              issue signed, on-record verdicts. No private keys for you to lose. No counter-party risk.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/escrow"><Button size="sm">Open escrow dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
              <Link to="/escrow/new"><Button size="sm" variant="outline">Start new escrow</Button></Link>
              <Link to="/marketplace"><Button size="sm" variant="ghost">Browse marketplace</Button></Link>
            </div>
          </div>
          <MediatorBot className="hidden lg:block" />
        </div>
      </section>

      {/* Company stats */}
      <section className="grid gap-3 sm:grid-cols-4">
        <Stat label="Custody model" value="Custodial" sub="BTCPay + LND treasury" />
        <Stat label="Settlement" value="Instant" sub="Internal ledger transfers" />
        <Stat label="Min. arbitration SLA" value="< 24h" sub="Bot triage → human judge" />
        <Stat label="Supported asset" value="BTC" sub="On-chain & Lightning" />
      </section>

      {/* How it works */}
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

      {/* Trust & transparency */}
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

      {/* Infrastructure */}
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
        Live status, balances, and active trades — head to the{" "}
        <Link to="/escrow" className="text-primary hover:underline">Escrow dashboard</Link>.
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </Card>
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
