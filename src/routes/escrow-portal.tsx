import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShieldCheck, Plus, ArrowRight, FileText, Handshake } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listMyEscrowDeals } from "@/lib/escrow-portal.functions";
import { formatDistanceToNow } from "date-fns";
import { ESCROW_DEAL_TYPES } from "@/lib/brand";

export const Route = createFileRoute("/escrow-portal")({
  head: () => ({
    meta: [
      { title: "Escrow Portal — Novain Escrowdesk" },
      { name: "description", content: "Create secure escrow deals with any counterparty worldwide. 20 deal types, from marketplace to milestone to import/export." },
      { property: "og:title", content: "Escrow Portal — Novain Escrowdesk" },
      { property: "og:description", content: "Independent escrow for any transaction. Invite a buyer or seller by link — no marketplace listing required." },
    ],
  }),
  component: EscrowPortal,
});

function EscrowPortal() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchDeals = useServerFn(listMyEscrowDeals);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["my-escrow-deals"],
    queryFn: () => fetchDeals(),
    enabled: !!user,
  });

  const typeLabel = (v: string) =>
    ESCROW_DEAL_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      {/* Portal hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
              Novain Escrowdesk · Escrow Portal
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Escrow for any transaction, from any source.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a deal, invite your counterparty by link, agree terms, deposit funds. Independent
              of any marketplace — perfect for direct, cross-border, or off-platform transactions.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2 rounded-full">
            <Link to="/escrow-portal/new">
              <Plus className="h-4 w-4" /> Create Escrow
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Feature icon={ShieldCheck} title="20 escrow types"
            body="Marketplace, service, vehicle, property, milestone, domain, software — pick the fit." />
          <Feature icon={Handshake} title="Invite by link"
            body="Send a secure link to any counterparty. They sign up and accept in one flow." />
          <Feature icon={FileText} title="Auditable terms"
            body="Every action is cryptographically signed and stored for later dispute review." />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My deals</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/escrow-portal/new"><Plus className="mr-1 h-3.5 w-3.5" /> New</Link>
          </Button>
        </div>

        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : deals.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You don't have any escrow deals yet.
            </p>
            <Button asChild className="mt-4">
              <Link to="/escrow-portal/new">Create your first escrow</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid gap-2">
            {deals.map((d) => (
              <Link
                key={d.id}
                to="/escrow-portal/$dealId"
                params={{ dealId: d.id }}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{d.reference}</span>
                    <Badge variant="secondary" className="text-[10px]">{typeLabel(d.deal_type)}</Badge>
                    <Badge className="text-[10px] capitalize" variant="outline">{d.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Created {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-sm">{Number(d.amount).toFixed(d.currency === "BTC" ? 8 : 2)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.currency}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/40 p-4">
      <div className="grid h-9 w-9 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
