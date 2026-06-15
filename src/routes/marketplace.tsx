import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { listProducts, buyProduct } from "@/lib/products.functions";
import { AdBanner } from "@/components/AdBanner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fmtFiat } from "@/lib/format";
import { MARKETPLACE_CATEGORIES, SORT_OPTIONS, type MarketplaceCategory, type SortKey } from "@/lib/marketplace-categories";
import { CategoryPlaceholder } from "@/components/CategoryPlaceholder";
import { PortfolioHero } from "@/components/PortfolioHero";
import { toast } from "sonner";
import { Search, ShoppingBag, Sparkles, Loader2, Star, ChevronLeft, ChevronRight, Eye } from "lucide-react";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — EscrowDesk" },
      { name: "description", content: "Browse BIN, Enroll, Scanner and Combo stores. Every purchase opens an escrow group automatically." },
    ],
  }),
  component: MarketplacePage,
});

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  image_url: string | null;
  stock: number;
  status: string;
  is_featured: boolean;
  seller_wallet_asset: string | null;
  created_at: string;
  card_number?: string | null;
  bin_number?: string | null;
  card_type?: string | null;
  card_bank?: string | null;
  card_user?: string | null;
};

const PAGE_SIZE = 12;

function MarketplacePage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(listProducts);
  const [tab, setTab] = useState<MarketplaceCategory>("BIN/CC");

  const { data, isLoading } = useQuery({
    queryKey: ["products-all"],
    queryFn: () => fetchFn({}),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("products-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketplace_products" },
        () => qc.invalidateQueries({ queryKey: ["products-all"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const products = (data?.products ?? []) as Product[];
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.category] = (m[p.category] ?? 0) + 1;
    return m;
  }, [products]);

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <PortfolioHero
        eyebrow="Curated marketplace"
        title="Four stores. One escrow."
        subtitle="Browse BIN, Enroll, Scanner and Combo stores. Every purchase opens an escrow group automatically — funds stay locked until the order is delivered."
        icon={ShoppingBag}
        stats={MARKETPLACE_CATEGORIES.map((c, i) => ({
          label: c.label,
          value: counts[c.value] ?? 0,
          hint: c.blurb,
          accent: (["primary","amber","emerald","sky"] as const)[i],
        }))}
      />


      <AdBanner placement="marketplace_grid" variant="banner" className="block" />
      <AdBanner placement="center" variant="banner" className="block" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as MarketplaceCategory)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-secondary/50 p-1 overflow-x-auto">
          {MARKETPLACE_CATEGORIES.map((c) => (
            <TabsTrigger key={c.value} value={c.value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm px-2 sm:px-3 py-2 sm:py-2">
              {c.label}
              <span className="ml-1 sm:ml-2 rounded-full bg-background/30 px-1 sm:px-1.5 py-0.5 font-mono text-[10px]">{counts[c.value] ?? 0}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {MARKETPLACE_CATEGORIES.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-4 sm:mt-5">
            <StoreSection category={c.value} blurb={c.blurb} isLoading={isLoading} all={products.filter((p) => p.category === c.value)} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StoreSection({ category, blurb, all, isLoading }: { category: MarketplaceCategory; blurb: string; all: Product[]; isLoading: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const buyFn = useServerFn(buyProduct);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { setPage(1); }, [q, sort, category]);

  const filtered = useMemo(() => {
    let list = all;
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle));
    }
    const sorted = [...list];
    switch (sort) {
      case "price_asc":  sorted.sort((a, b) => a.price - b.price); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price); break;
      case "name":       sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      default:           sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    // featured first within the chosen sort
    sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return sorted;
  }, [all, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const buy = async (p: Product) => {
    if (!user) return nav({ to: "/auth" });
    setBusyId(p.id);
    try {
      const r = await buyFn({ data: { id: p.id } });
      toast.success("Escrow group opened");
      nav({ to: "/escrow/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold sm:text-lg">{category} Store</h2>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full flex-1 sm:min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={category === "BIN/CC" ? "Search BIN…" : `Search ${category}…`}
              className="pl-9 text-sm"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
        </div>
      ) : pageItems.length === 0 ? (
        <p className="surface p-6 sm:p-10 text-center text-sm text-muted-foreground">
          No products in {category} yet. {q && "Try a different search."}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((p) => <Card key={p.id} p={p} onBuy={buy} busy={busyId === p.id} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((x) => Math.max(1, x - 1))}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground font-mono">Page {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((x) => Math.min(totalPages, x + 1))}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

function maskCardNumber(num: string) {
  const digits = num.replace(/\D/g, "");
  if (digits.length < 6) return num;
  const visible = digits.slice(0, 6);
  const masked = "**** **** ****";
  return `${visible} ${masked}`;
}

function Card({ p, onBuy, busy }: { p: Product; onBuy: (p: Product) => void; busy: boolean }) {
  const visibleCard = p.card_number ? maskCardNumber(p.card_number) : p.bin_number ? `${p.bin_number} **** **** ****` : null;
  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      whileHover={{ y: -2 }}
      className="group flex flex-col overflow-hidden rounded-lg border border-border/70 bg-card/80 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-video w-full overflow-hidden border-b border-border/60 bg-secondary/40">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
        ) : (
          <CategoryPlaceholder category={p.category} name={p.name} />
        )}
        <Badge variant="outline" className="absolute right-2 top-2 border-border/60 bg-background/85 text-[10px] font-mono uppercase tracking-wider backdrop-blur">
          {p.category}
        </Badge>
        {p.is_featured && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Star className="h-3 w-3" /> Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{p.name}</h3>
          <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-primary">
            {fmtFiat(Number(p.price), p.currency)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">{p.description}</p>
        {visibleCard && (
          <div className="mt-3 rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
            <div className="font-mono text-[11px] tracking-wider text-foreground/90">{visibleCard}</div>
            {(p.card_bank || p.card_type) && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {[p.card_bank, p.card_type].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${p.status === "active" ? "bg-success" : "bg-muted-foreground/40"}`} />
            {p.status}
          </span>
          {p.stock >= 0 && p.stock < 10 && (
            <Badge variant="secondary" className="text-[10px]">{p.stock} left</Badge>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link to="/product/$id" params={{ id: p.id }}><Eye className="h-3 w-3 mr-1" />Details</Link>
          </Button>
          <Button size="sm" onClick={() => onBuy(p)} disabled={busy} className="text-xs">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Purchase
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
