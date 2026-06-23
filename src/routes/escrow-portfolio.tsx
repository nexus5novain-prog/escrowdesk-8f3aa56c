import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { ParticleBackground } from "@/components/ParticleBackground";
import { MediatorBot } from "@/components/MediatorBot";
import { MyBalanceStrip } from "@/components/wallet/MyBalanceStrip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, Zap, Scale, FileSignature, Handshake, ArrowRight, Bitcoin, Bot } from "lucide-react";

export const Route = createFileRoute("/escrow-portfolio")({
  component: () => (<AuthGate><EscrowAbout /></AuthGate>),
});

function EscrowAbout() {
  return (
    <div className="space-y-6">
      {/* Hero with animated mediator bot */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-background to-background p-6 sm:p-10">
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
              EscrowDesk holds funds in a custodial vault until both parties confirm the deal.
              If something goes wrong, our arbitration bot and human judges step in.
              No private keys to manage. No counterparty risk.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/escrow/new"><Button size="sm">Start new escrow <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
              <Link to="/trades"><Button size="sm" variant="outline">My trades</Button></Link>
              <Link to="/wallet"><Button size="sm" variant="outline">Wallet</Button></Link>
            </div>
          </div>
          <MediatorBot className="hidden lg:block" />
        </div>
      </div>

      {/* Small live balance strip (user-scoped) */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Your live balances</p>
          <Link to="/wallet" className="text-xs text-primary hover:underline">Open wallet →</Link>
        </div>
        <MyBalanceStrip />
      </Card>

      {/* How it works */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">How EscrowDesk works</h2>
        <p className="mt-1 text-sm text-muted-foreground">Four steps — fully internal, no on-chain transfers between parties.</p>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} icon={<Handshake className="h-5 w-5" />} title="Agree terms" body="Both parties sign exact terms inside the trade chat — legally meaningful, audit-logged." />
          <Step n={2} icon={<Lock className="h-5 w-5" />} title="Lock funds" body="Buyer funds escrow from their wallet balance. Crypto moves to a locked bucket, instantly." />
          <Step n={3} icon={<FileSignature className="h-5 w-5" />} title="Deliver & confirm" body="Seller delivers off-platform. Buyer confirms receipt; arbitration available 24/7 if not." />
          <Step n={4} icon={<Zap className="h-5 w-5" />} title="Release" body="Funds move to seller's available balance — withdrawable as Bitcoin, Lightning, or Flutterwave." />
        </ol>
      </Card>

      {/* Why it's safe */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Why icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />} title="Custodial vault" body="Private keys live with EscrowDesk's hardened BTCPay + LND treasury. You never sign a transaction." />
        <Why icon={<Scale className="h-5 w-5 text-blue-500" />} title="Arbitration first" body="Disputes go to a panel — bot triage, then mediator, judge, and appeal. Decisions are signed and on-record." />
        <Why icon={<Bitcoin className="h-5 w-5 text-orange-500" />} title="Bitcoin native" body="Deposit on-chain or via Lightning. Withdraw the same. Fiat rails (Flutterwave) coming online." />
      </div>
    </div>
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
