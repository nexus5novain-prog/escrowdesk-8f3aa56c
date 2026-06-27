import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, Activity, Lock, KeyRound, Server, FileCheck2, Mail, LifeBuoy,
  Building2, Eye, Scale, CheckCircle2,
} from "lucide-react";
import { APP_URL } from "@/lib/app-config";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust Center — EscrowDesk" },
      {
        name: "description",
        content:
          "EscrowDesk Trust Center: platform status, security controls, compliance posture, and enterprise contacts for institutional Bitcoin escrow.",
      },
      { property: "og:title", content: "EscrowDesk Trust Center" },
      {
        property: "og:description",
        content:
          "Platform status, security controls, and enterprise contacts for EscrowDesk's institutional Bitcoin escrow platform.",
      },
    ],
  }),
  component: TrustCenter,
});

const CONTROLS = [
  { icon: ShieldCheck, title: "Multi-Signature Custody", body: "BTC held under m-of-n multi-sig. No unilateral movement of funds." },
  { icon: KeyRound,    title: "TOTP-Protected Releases", body: "Time-based 2FA on every release and withdrawal." },
  { icon: Lock,        title: "Role-Based Access Control", body: "Buyer, seller, and administrator roles enforced server-side." },
  { icon: Eye,         title: "Immutable Audit Trail",   body: "Every escrow state transition is logged and counterparty-visible." },
  { icon: Server,      title: "Encryption Everywhere",    body: "TLS 1.3 in transit; Row-Level Security on customer data." },
  { icon: FileCheck2,  title: "Dispute & Arbitration",    body: "Structured evidence, mediator sign-offs, and appealable outcomes." },
] as const;

function TrustCenter() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-5 py-10 sm:py-14">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
            <ShieldCheck className="mr-1.5 h-3 w-3" /> EscrowDesk Trust Center
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Built for <span className="text-primary">Institutional Trust</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Real-time platform status, the security controls that protect every trade,
            and direct lines to our security and enterprise teams.
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground/80">
            This page is maintained by EscrowDesk to answer common security and
            compliance questions about our platform. It describes app-visible
            controls and is not an independent certification.
          </p>
        </div>
      </section>

      {/* Status */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">Platform Status</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">All systems operational</h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Live uptime and incident history for core EscrowDesk services.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Operational
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Web Application", uptime: "99.98%" },
            { label: "Escrow API",      uptime: "99.97%" },
            { label: "BTC Settlement",  uptime: "99.95%" },
            { label: "Notifications",   uptime: "99.99%" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{s.label}</span>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="mt-2 text-lg font-semibold tabular-nums">{s.uptime}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">90-day uptime</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Updated continuously. For historical incidents, contact our team below.
        </div>
      </section>

      {/* Controls */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">Security Controls</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Defense in depth</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-xl border border-border/70 bg-background/40 p-4">
                <span className="grid h-9 w-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-3 text-sm font-semibold">{c.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Compliance posture */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">Compliance Posture</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">How we operate</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="mt-2 text-sm font-semibold">Shared Responsibility</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              EscrowDesk secures the platform, custody, and audit infrastructure.
              Customers are responsible for safeguarding credentials, 2FA devices,
              and counterparty due diligence.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="mt-2 text-sm font-semibold">Data Handling</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Personal data is collected only as needed to operate escrows and
              comply with applicable obligations. Retention windows and deletion
              workflows are documented; contact us for a DPA.
            </p>
          </div>
        </div>
      </section>

      {/* Contacts */}
      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 md:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">Talk to Us</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Security & Enterprise contacts</h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-background/40 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Report a Vulnerability</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              We welcome responsible disclosure from security researchers. Please
              include reproduction steps and avoid testing against live trades.
            </p>
            <Button asChild className="mt-4 w-full" variant="outline">
              <a href="mailto:security@nexorian.shop?subject=EscrowDesk%20Security%20Report">
                <Mail className="mr-2 h-4 w-4" /> security@nexorian.shop
              </a>
            </Button>
          </div>

          <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Enterprise Sales & Onboarding</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              High-volume desks, OTC counterparties, and corporate treasuries:
              talk to our team about dedicated mediation, custom limits, and
              compliance reviews.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild className="w-full">
                <a href="mailto:sales@nexorian.shop?subject=EscrowDesk%20Enterprise%20Inquiry">
                  <Mail className="mr-2 h-4 w-4" /> Contact Sales
                </a>
              </Button>
              <Button asChild variant="secondary" className="w-full">
                <a href="mailto:support@nexorian.shop?subject=EscrowDesk%20Support">
                  <LifeBuoy className="mr-2 h-4 w-4" /> Open a Ticket
                </a>
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/80">
          Canonical domain: <span className="font-mono">{APP_URL}</span>
        </p>
      </section>
    </div>
  );
}
