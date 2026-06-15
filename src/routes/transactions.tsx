import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyPortfolioStats } from "@/lib/escrow.functions";
import { PortfolioHero } from "@/components/PortfolioHero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtFiat } from "@/lib/format";
import { Wallet, TrendingUp, TrendingDown, ShoppingBag, PackageCheck, XCircle, AlertTriangle, RotateCcw, FilePlus2, Download, Eye, Receipt } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "My Transactions — EscrowDesk" },
      { name: "description", content: "Your full transaction portfolio: spending, earnings, trades, refunds and purchased products." },
    ],
  }),
  component: () => (<AuthGate><TransactionsPage /></AuthGate>),
});

type Purchase = {
  id: string;
  listing_id: string | null;
  listing_name: string | null;
  listing_category: string | null;
  asset: string;
  amount: number;
  fiat_amount: number;
  fiat_currency: string;
  status: string;
  created_at: string;
  card_number?: string | null;
  bin_number?: string | null;
  card_user?: string | null;
  card_type?: string | null;
  card_brand?: string | null;
  card_bank?: string | null;
  card_country?: string | null;
  card_address?: string | null;
  cvv?: string | null;
  expire_date?: string | null;
};

function TransactionsPage() {
  const fetchStats = useServerFn(getMyPortfolioStats);
  const { data, isLoading } = useQuery({ queryKey: ["my-portfolio"], queryFn: () => fetchStats(), refetchInterval: 30_000 });
  const s = data?.stats;
  const purchases = (data?.purchases ?? []) as Purchase[];

  const downloadAll = () => {
    if (!purchases.length) return;
    const header = ["id","listing_name","category","status","fiat_amount","fiat_currency","asset","crypto_amount","created_at"];
    const rows = purchases.map((p) => [p.id, p.listing_name ?? "", p.listing_category ?? "", p.status, p.fiat_amount, p.fiat_currency, p.asset, p.amount, p.created_at]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `escrowdesk-transactions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadOne = (p: Purchase) => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${p.listing_name || p.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PortfolioHero
        eyebrow="My portfolio"
        title="Your transaction dashboard"
        subtitle="A full record of everything you've bought, sold, and traded across the platform."
        icon={Receipt}
        gradient="from-violet-500/25 via-primary/15 to-emerald-500/15"
        stats={[
          { label: "Amount spent", value: fmtFiat(s?.spent ?? 0, "USD"), icon: TrendingDown, accent: "rose" },
          { label: "Amount earned", value: fmtFiat(s?.earned ?? 0, "USD"), icon: TrendingUp, accent: "emerald" },
          { label: "Bought", value: s?.bought ?? 0, icon: ShoppingBag, accent: "primary" },
          { label: "Sold", value: s?.sold ?? 0, icon: PackageCheck, accent: "sky" },
          { label: "Successful", value: s?.successful ?? 0, icon: PackageCheck, accent: "emerald" },
          { label: "Failed", value: s?.failed ?? 0, icon: XCircle, accent: "rose" },
          { label: "Rejected", value: s?.rejected ?? 0, icon: XCircle, accent: "amber" },
          { label: "Created", value: s?.created ?? 0, icon: FilePlus2, accent: "primary" },
          { label: "Refunded", value: fmtFiat(s?.refunded ?? 0, "USD"), icon: RotateCcw, accent: "amber" },
          { label: "Warnings", value: s?.warnings ?? 0, icon: AlertTriangle, accent: "rose" },
          { label: "Active trades", value: s?.active_trades ?? 0, icon: Wallet, accent: "violet" },
          { label: "Active groups", value: s?.active_groups ?? 0, icon: Wallet, accent: "sky" },
        ]}
      />

      <section className="surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Bought products & services</h2>
            <p className="text-xs text-muted-foreground">Full record of every escrow group you opened — view details or download a copy any time.</p>
          </div>
          <Button size="sm" variant="outline" onClick={downloadAll} disabled={!purchases.length}>
            <Download className="mr-1 h-3 w-3" /> Export all (CSV)
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : purchases.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">No purchases yet. Head to the <Link to="/marketplace" className="underline">marketplace</Link> to get started.</p>
        ) : (
          <div className="mt-4 divide-y divide-border/40">
            {purchases.map((p) => {
              const hasCardDetails = p.listing_category === "BIN" && (p.card_number || p.bin_number);
              const showCardDetails = hasCardDetails && (p.status === "released" || p.status === "active" || p.status === "funded");
              
              return (
                <div key={p.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.listing_name ?? `Escrow ${p.id.slice(0,8)}`}</span>
                        {p.listing_category && <Badge variant="outline">{p.listing_category}</Badge>}
                        <Badge variant={p.status === "released" ? "default" : p.status === "cancelled" ? "destructive" : "secondary"}>{p.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()} · {fmtFiat(Number(p.fiat_amount), p.fiat_currency)} · {Number(p.amount).toFixed(8)} {p.asset}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/escrow/$id" params={{ id: p.id }}><Eye className="mr-1 h-3 w-3" /> View</Link>
                      </Button>
                      {p.listing_id && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/product/$id" params={{ id: p.listing_id }}>Product</Link>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => downloadOne(p)}>
                        <Download className="mr-1 h-3 w-3" /> Download
                      </Button>
                    </div>
                  </div>
                  
                  {showCardDetails && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
                      <div className="mb-2 font-semibold text-amber-900 dark:text-amber-100">Card Details</div>
                      <div className="grid gap-2">
                        {p.card_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Card Number:</span>
                            <span className="font-mono">{p.card_number}</span>
                          </div>
                        )}
                        {p.bin_number && !p.card_number && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">BIN:</span>
                            <span className="font-mono">{p.bin_number}</span>
                          </div>
                        )}
                        {p.card_user && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cardholder:</span>
                            <span>{p.card_user}</span>
                          </div>
                        )}
                        {p.expire_date && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Expires:</span>
                            <span className="font-mono">{p.expire_date}</span>
                          </div>
                        )}
                        {p.cvv && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">CVV:</span>
                            <span className="font-mono">●●●</span>
                          </div>
                        )}
                        {p.card_type && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Type:</span>
                            <span>{p.card_type}</span>
                          </div>
                        )}
                        {p.card_brand && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Brand:</span>
                            <span>{p.card_brand}</span>
                          </div>
                        )}
                        {p.card_bank && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bank:</span>
                            <span>{p.card_bank}</span>
                          </div>
                        )}
                        {p.card_country && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Country:</span>
                            <span>{p.card_country}</span>
                          </div>
                        )}
                        {p.card_address && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Address:</span>
                            <span>{p.card_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
