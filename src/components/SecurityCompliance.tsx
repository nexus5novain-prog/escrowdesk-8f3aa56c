import { Link } from "@tanstack/react-router";
import { Shield, KeyRound, Lock, Eye, Server, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONTROLS = [
  {
    icon: Shield,
    title: "Multi-Signature Custody",
    body: "Escrowed BTC is held under m-of-n multi-sig. No single party — including EscrowDesk — can move funds unilaterally.",
  },
  {
    icon: KeyRound,
    title: "TOTP-Protected Releases",
    body: "Every release and withdrawal requires a time-based one-time password. Trusted-device policies enforced server-side.",
  },
  {
    icon: Lock,
    title: "Hardened Operational Controls",
    body: "Role-based access for buyers, sellers, and administrators. Privileged actions gated by SECURITY DEFINER checks and audit logs.",
  },
  {
    icon: Eye,
    title: "Transparent Audit Trail",
    body: "Every state transition is recorded to an immutable ledger. Counterparties and mediators see the same evidence.",
  },
  {
    icon: Server,
    title: "Encrypted In Transit & At Rest",
    body: "TLS 1.3 everywhere. Row-Level Security on all customer data. Service-role keys never reach client code.",
  },
  {
    icon: FileCheck2,
    title: "Dispute & Arbitration Framework",
    body: "Structured evidence intake, mediator sign-offs, and appealable decisions — designed for corporate workflows.",
  },
] as const;

const BADGES = [
  "Multi-Sig Custody",
  "TOTP 2FA Enforced",
  "RLS on All Tables",
  "TLS 1.3",
  "Auditable Ledger",
  "RBAC",
] as const;

export function SecurityCompliance() {
  return (
    <section
      id="security"
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
            Security & Compliance
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Engineered for Institutional Trust
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            EscrowDesk applies defense-in-depth across custody, identity, and
            operational controls. Below are the safeguards active on every trade.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/trust">Visit Trust Center →</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTROLS.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.title}
              className="rounded-xl border border-border/70 bg-background/40 p-4 transition-colors hover:bg-background/70"
            >
              <span className="grid h-9 w-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {BADGES.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-primary"
          >
            <Shield className="h-3 w-3" />
            {b}
          </span>
        ))}
      </div>
    </section>
  );
}
