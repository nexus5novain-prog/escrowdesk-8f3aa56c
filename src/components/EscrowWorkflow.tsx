import { FileText, ShieldCheck, Bitcoin, KeyRound, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    n: 1,
    title: "Request",
    icon: FileText,
    buyer: "Open an escrow request specifying asset, amount, terms, and counterparty.",
    seller: "Review the request, confirm scope and pricing, and accept to proceed.",
  },
  {
    n: 2,
    title: "Verify",
    icon: ShieldCheck,
    buyer: "Complete identity & 2FA. Confirm the counterparty's verified profile.",
    seller: "Provide proof of inventory or deliverable. Compliance checks are logged.",
  },
  {
    n: 3,
    title: "Fund",
    icon: Bitcoin,
    buyer: "Send BTC on-chain or via Lightning to the unique escrow address.",
    seller: "Funds are locked in multi-signature custody — neither party can move them alone.",
  },
  {
    n: 4,
    title: "Release",
    icon: KeyRound,
    buyer: "Confirm delivery and authorize release with a TOTP-protected signature.",
    seller: "Receive the release approval. Mediator co-signs only if a dispute is opened.",
  },
  {
    n: 5,
    title: "Settle",
    icon: CheckCircle2,
    buyer: "Receive a signed settlement record for accounting and audit.",
    seller: "Funds settle on-chain to your verified payout address. Trade is closed.",
  },
] as const;

export function EscrowWorkflow() {
  return (
    <section
      id="workflow"
      className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
            How It Works
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            The Escrow Workflow
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-sm">
            A transparent, five-stage process built around two parties and an
            impartial mediator. Every action is auditable and cryptographically signed.
          </p>
        </div>
      </div>

      <ol className="grid gap-3 md:grid-cols-5">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="group relative flex flex-col rounded-xl border border-border/70 bg-background/40 p-4 transition-colors hover:bg-background/70"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Step {s.n}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
              <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground/90">Buyer:</span>{" "}
                  {s.buyer}
                </p>
                <p>
                  <span className="font-medium text-foreground/90">Seller:</span>{" "}
                  {s.seller}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
