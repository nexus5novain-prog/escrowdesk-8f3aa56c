import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listMarketplace, type ListingRow, type Tier } from "@/lib/marketplace.functions";
import { createEscrowGroup } from "@/lib/escrow-groups.functions";
import { MediatorBot } from "@/components/MediatorBot";
import { AdBanner } from "@/components/AdBanner";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtFiat } from "@/lib/format";
import { toast } from "sonner";
import { Crown, ShieldCheck, Send, Globe, Plus, Search, Sparkles, ArrowLeftRight, Handshake, Loader2 } from "lucide-react";
import { PortfolioHero } from "@/components/PortfolioHero";
import { THREAD_SECTIONS, sectionOf } from "@/lib/thread-categories";

export const Route = createFileRoute("/order-book")({
  head: () => ({
    meta: [
      { title: "Threads — EscrowDesk" },
      { name: "description", content: "Browse active selling and seeking threads from premium, trusted, and regular members across BIN, Enroll, Scanner and Combo categories." },
    ],
  }),
  component: OrderBookPage,
});

const CATEGORY_TABS = ["All", ...THREAD_SECTIONS.map((s) => s.label)] as const;
type CatTab = (typeof CATEGORY_TABS)[number];

function OrderBookPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const fetchMarket = useServerFn(listMarketplace);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CatTab>("All");
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["order-book", q],
    queryFn: () => fetchMarket({ data: { q: q || undefined } }),
    refetchInterval: 20_000,
  });

  const tiers: { key: Tier; label: string; icon: React.ReactNode; subtitle: string; emptyHint?: string }[] = [
    { key: "premium", label: "Premium members", icon: <Crown className="h-4 w-4" />, subtitle: "Top-tier merchants: Trusted + 25 trades, 15 five-star ratings, $5,000 BTC traded.", emptyHint: "No Premium members yet. Reach the milestones from your Wallet page to unlock this tier." },
    { key: "trusted", label: "Trusted & vouched", icon: <ShieldCheck className="h-4 w-4" />, subtitle: "Earn the Trusted badge: 5 successful trades, 5 different 4★+ raters, 3 trades with one partner, $500 BTC traded.", emptyHint: "No Trusted members yet — be the first to complete the journey." },
    { key: "regular", label: "Regular members", icon: <Sparkles className="h-4 w-4" />, subtitle: "New & standard sellers and seekers." },
  ];

  // Filter rows by the selected top-level forum section (resolved from the
  // stored "Section · Subcategory" string).
  const filterCat = (rows: ListingRow[]) =>
    cat === "All" ? rows : rows.filter((r) => sectionOf(r.category) === cat);

  return (
    <div className="space-y-8 md:space-y-10">
      <PortfolioHero
        eyebrow="Peer-to-peer threads"
        title="Post a thread. Discover what you need."
        subtitle="Our mediator bot sits between buyer and seller — chat, agree, and trade safely. Every thread can open an escrow group instantly."
        icon={ArrowLeftRight}
        gradient="from-sky-500/25 via-primary/15 to-violet-500/20"
        stats={[
          { label: "Active threads", value: data?.total ?? 0, accent: "primary" },
          { label: "Premium", value: ((data?.groups?.premium?.selling?.length ?? 0) + (data?.groups?.premium?.seeking?.length ?? 0)), accent: "amber", icon: Crown },
          { label: "Trusted", value: ((data?.groups?.trusted?.selling?.length ?? 0) + (data?.groups?.trusted?.seeking?.length ?? 0)), accent: "emerald", icon: ShieldCheck },
          { label: "Regular", value: ((data?.groups?.regular?.selling?.length ?? 0) + (data?.groups?.regular?.seeking?.length ?? 0)), accent: "sky", icon: Sparkles },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => nav({ to: user ? "/post-listing" : "/auth" })} className="gap-2">
          <Plus className="h-4 w-4" /> Post a thread
        </Button>
        <Link to="/marketplace"><Button variant="outline">E-commerce marketplace</Button></Link>
      </div>
      <div className="hidden md:block"><MediatorBot /></div>


      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6 md:space-y-8">
          {/* Search + category tabs */}
          <section className="surface p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search threads by name…" className="pl-9" />
              </div>
              <Badge variant="secondary" className="font-mono">{data?.total ?? 0} active</Badge>
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_TABS.map((c) => (
                <button key={c} onClick={() => setCat(c)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${cat === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60"}`}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* Tier sections — already rank-sorted server-side */}
          {tiers.map((t) => {
            const group = data?.groups?.[t.key];
            return (
              <TierSection
                key={t.key}
                label={t.label}
                subtitle={t.subtitle}
                icon={t.icon}
                emptyHint={t.emptyHint}
                selling={filterCat(group?.selling ?? [])}
                seeking={filterCat(group?.seeking ?? [])}
                loading={isLoading}
              />
            );
          })}
        </div>

        {/* Sidebar ads */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <AdBanner placement="order_book_sidebar" variant="sidebar" />
        </aside>
      </div>
    </div>
  );
}

function TierSection({ label, subtitle, icon, emptyHint, selling, seeking, loading }: {
  label: string; subtitle: string; icon: React.ReactNode; emptyHint?: string;
  selling: ListingRow[]; seeking: ListingRow[]; loading?: boolean;
}) {
  const isEmpty = selling.length === 0 && seeking.length === 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
      className="surface p-4 sm:p-5"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 text-primary">{icon}</div>
          <div>
            <h2 className="text-base font-semibold leading-tight sm:text-lg">{label}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ListingTable title="Selling" tone="primary" rows={selling} loading={loading} emptyText="No active selling threads." />
        <ListingTable title="Seeking" tone="accent" rows={seeking} loading={loading} emptyText="No active seeking threads." />

      </div>

      {isEmpty && emptyHint && !loading && (
        <p className="mt-3 rounded-md border border-dashed border-border/60 bg-secondary/20 px-3 py-2 text-center text-[11px] text-muted-foreground">
          {emptyHint}
        </p>
      )}
    </motion.section>
  );
}


function ListingTable({ title, tone, rows, loading, emptyText }: {
  title: string; tone: "primary" | "accent"; rows: ListingRow[]; loading?: boolean; emptyText: string;
}) {
  const accent = tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/10">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className={`text-sm font-semibold uppercase tracking-wider ${accent}`}>{title}</h3>
        <span className="text-[10px] font-mono text-muted-foreground">{rows.length} thread{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="max-h-[420px] divide-y divide-border/40 overflow-y-auto">
        <AnimatePresence initial={false}>
          {rows.map((r) => <ListingCard key={r.id} row={r} />)}
        </AnimatePresence>
        {!loading && rows.length === 0 && (
          <p className="p-6 text-center text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function ListingCard({ row }: { row: ListingRow }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const createGroup = useServerFn(createEscrowGroup);
  const [busy, setBusy] = useState(false);
  const tg = row.contact_telegram?.replace(/^@/, "");
  const tgLink = tg ? `https://t.me/${tg}` : row.profile?.telegram_username ? `https://t.me/${row.profile.telegram_username.replace(/^@/, "")}` : null;
  const web = row.contact_website
    ? row.contact_website.startsWith("http") ? row.contact_website : `https://${row.contact_website}`
    : null;
  const rating = useMemo(() => {
    if (!row.profile?.rating_count) return null;
    return (row.profile.rating_sum / row.profile.rating_count).toFixed(1);
  }, [row.profile]);

  const startTrade = async () => {
    if (!user) return nav({ to: "/auth" });
    if (row.kind !== "selling") {
      return nav({ to: "/escrow/new", search: { listing: row.id } });
    }
    setBusy(true);
    try {
      const fiat = row.amount != null ? Number(row.amount) : 0;
      const res = await createGroup({ data: {
        asset: "BTC",
        amount: fiat > 0 ? fiat : 1,
        fiat_amount: fiat > 0 ? fiat : undefined,
        fiat_currency: row.currency || "USD",
        listing_id: row.id,
      } });
      toast.success("Escrow group created");
      nav({ to: "/escrow/$id", params: { id: res.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      whileHover={{ backgroundColor: "color-mix(in oklab, var(--secondary) 30%, transparent)" }}
      className="p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{row.name}</span>
            {row.profile?.is_premium && <Crown className="h-3.5 w-3.5 text-primary" />}
            {row.profile?.is_trusted && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{row.category}</Badge>
            {row.amount != null && (
              <span className="font-mono text-xs text-primary">{fmtFiat(Number(row.amount), row.currency || "USD")}</span>
            )}
            <span className="text-[10px] text-muted-foreground">· {row.profile?.display_name ?? "—"}</span>
            {rating && <span className="text-[10px] text-muted-foreground">· ★ {rating}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" onClick={startTrade} disabled={busy} className="h-7 gap-1 px-2 text-[11px]">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Handshake className="h-3 w-3" />}
            {row.kind === "selling" ? "Trade" : "Offer"}
          </Button>
          {tgLink && (
            <a href={tgLink} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" className="h-7 gap-1 px-2 text-[11px]"><Send className="h-3 w-3" /> Telegram</Button>
            </a>
          )}
          {web && (
            <a href={web} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]"><Globe className="h-3 w-3" /> Website</Button>
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
