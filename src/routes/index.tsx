import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AdBanner } from "@/components/AdBanner";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace-categories";
import { THREAD_SECTIONS, sectionOf } from "@/lib/thread-categories";
import { listMarketplace, type ListingRow } from "@/lib/marketplace.functions";
import { listProducts } from "@/lib/products.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck, Search, ArrowRight, Wallet, MessageSquare, Send, Lightbulb,
  Layers, CreditCard, Boxes, ScanLine, Megaphone, Lock, Activity, Trophy, Star, Coins, Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EscrowDesk — P2P Crypto Escrow Community" },
      { name: "description", content: "EscrowDesk is a mediated peer-to-peer escrow community. Browse listings, chat with traders in real time, track your wallet — all from one professional dashboard." },
      { property: "og:title", content: "EscrowDesk — P2P Crypto Escrow Community" },
      { property: "og:description", content: "Mediated peer-to-peer crypto escrow with a live community shoutbox, market threads and a personal trading dashboard." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="space-y-6">
      <Hero />
      <AnnouncementBanner />
      <UniversalSearch />
      <QuickCategories />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          <LatestThreads />
          <Shoutbox />
          <TipsWidget />
        </div>
        <aside className="space-y-6">
          <UserDashboard />
          <WalletCard />
          <ResourcesFeed />
        </aside>
      </div>
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-5 py-10 sm:py-14 md:py-16">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0, transparent 40%), radial-gradient(circle at 80% 60%, hsl(var(--accent)) 0, transparent 40%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-primary/80">
            <ShieldCheck className="mr-1.5 h-3 w-3" /> Mediated Peer-to-Peer Escrow
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            EscrowDesk <span className="text-primary">Community</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
            From BIN trades, scanners, enroll kits and combo packs — every deal is mediated, signed and settled on-platform.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/marketplace">Enter Marketplace <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/auth">Create account</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────── Announcement banner (from ad_banners) ─────────── */
function AnnouncementBanner() {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary">
          <Megaphone className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <AdBanner placement="top" variant="card" className="block" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Universal search ───────────────── */
function UniversalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); navigate({ to: "/marketplace", search: { q } as never }); }}
      className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2"
    >
      <Search className="h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search listings, BINs, scanners, sellers…"
        className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <Button type="submit" size="sm">Search</Button>
    </form>
  );
}

/* ───────────────── Quick categories ───────────────── */
function QuickCategories() {
  const items = [
    { label: "New Threads", to: "/marketplace", icon: Activity },
    { label: "BIN Store", to: "/marketplace", icon: CreditCard, category: "BIN/CC" },
    { label: "Enroll Store", to: "/marketplace", icon: Layers, category: "Enroll" },
    { label: "Scanner Store", to: "/marketplace", icon: ScanLine, category: "Scanner" },
    { label: "Combo Store", to: "/marketplace", icon: Boxes, category: "Combo" },
    { label: "Threads", to: "/order-book", icon: Trophy },
    { label: "Post listing", to: "/post-listing", icon: Send },
    { label: "Post offer", to: "/post-offer", icon: Coins },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto rounded-xl border border-border/70 bg-card/60 p-2">
      {items.map((it) => (
        <Link
          key={it.label}
          to={it.to}
          search={it.category ? ({ category: it.category } as never) : undefined}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-foreground"
        >
          <it.icon className="h-3.5 w-3.5" /> {it.label}
        </Link>
      ))}
    </div>
  );
}

/* ───────────────── Latest threads (listings, realtime) ───────────────── */
const THREAD_TABS = ["All", ...THREAD_SECTIONS.map((s) => s.label)] as const;
type ThreadTab = (typeof THREAD_TABS)[number];

function LatestThreads() {
  const qc = useQueryClient();
  const fetchMarket = useServerFn(listMarketplace);
  const [tab, setTab] = useState<ThreadTab>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["landing", "threads"],
    queryFn: () => fetchMarket({ data: {} }),
    staleTime: 15_000,
  });

  // Live sync: refetch on any listing change
  useEffect(() => {
    const channel = supabase
      .channel("landing-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        qc.invalidateQueries({ queryKey: ["landing", "threads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const allRows: ListingRow[] = useMemo(() => {
    const g = data?.groups;
    if (!g) return [];
    return [
      ...g.premium.selling, ...g.premium.seeking,
      ...g.trusted.selling, ...g.trusted.seeking,
      ...g.regular.selling, ...g.regular.seeking,
    ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [data]);

  const rows = useMemo(
    () => (tab === "All" ? allRows : allRows.filter((r) => sectionOf(r.category) === tab)).slice(0, 12),
    [allRows, tab],
  );

  const countFor = (t: ThreadTab) =>
    t === "All" ? allRows.length : allRows.filter((r) => sectionOf(r.category) === t).length;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Latest Threads</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> live
          </span>
        </div>
        <Link to="/order-book" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
      </header>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border/60 bg-background/30 px-3 py-2">
        {THREAD_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              tab === t
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/60 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {t} <span className="ml-1 font-mono text-[10px] opacity-70">{countFor(t)}</span>
          </button>
        ))}
      </div>

      <div className="hidden grid-cols-[160px_1fr_120px_70px_70px_120px] gap-3 border-b border-border/60 bg-background/40 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:grid">
        <span>Poster</span><span>Thread</span><span>Category</span><span>Price</span><span>Status</span><span>Posted</span>
      </div>
      {isLoading ? (
        <div className="px-4 py-6 text-xs text-muted-foreground">Loading threads…</div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-6 text-xs text-muted-foreground">No threads in this category yet.</div>
      ) : (
        <ul className="divide-y divide-border/50">
          {rows.map((r) => {
            const p = r.profile;
            const name = p?.display_name || "anon";
            const avg = p && p.rating_count > 0 ? p.rating_sum / p.rating_count : 0;
            const tierBadge = p?.is_premium ? "Premium" : p?.is_trusted ? "Trusted" : null;
            return (
              <li key={r.id} className="grid grid-cols-1 gap-1 px-4 py-2.5 text-xs transition-colors hover:bg-background/40 sm:grid-cols-[160px_1fr_120px_70px_70px_120px] sm:items-center sm:gap-3">
                {/* Poster */}
                <div className="flex items-center gap-2 min-w-0">
                  {p?.avatar_url ? (
                    <img src={p.avatar_url} alt={name} className="h-6 w-6 shrink-0 rounded-full border border-border/60 object-cover" />
                  ) : (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 leading-tight">
                    <div className="truncate font-medium text-foreground">{name}</div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Star className="h-2.5 w-2.5 fill-warning text-warning" />
                      <span className="tabular-nums">{avg.toFixed(1)}</span>
                      {tierBadge && (
                        <span className={cn(
                          "ml-1 rounded-sm px-1 font-mono text-[9px] uppercase",
                          p?.is_premium ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400",
                        )}>{tierBadge}</span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Thread */}
                <Link to="/offer/$id" params={{ id: r.id }} className="truncate font-medium text-foreground hover:text-primary">
                  {r.name}
                </Link>
                <span className="truncate font-mono text-[10px] uppercase text-muted-foreground">{sectionOf(r.category)}</span>
                <span className="font-mono tabular-nums">
                  {r.amount != null ? `${r.currency === "USD" || !r.currency ? "$" : ""}${Number(r.amount).toFixed(2)}` : "—"}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> {r.status}
                </span>
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────────────── Shoutbox (realtime) ───────────────── */
type ShoutMsg = { id: string; user_id: string; display_name: string; body: string; created_at: string };

function Shoutbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: messages = [] } = useQuery({
    queryKey: ["shoutbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shoutbox_messages")
        .select("id,user_id,display_name,body,created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ShoutMsg[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("shoutbox-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "shoutbox_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["shoutbox"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (meta.display_name as string) || user?.email?.split("@")[0] || "anon";
  }, [user]);

  async function send() {
    if (!user) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    const { error } = await supabase.from("shoutbox_messages").insert({
      user_id: user.id, display_name: displayName, body: trimmed,
    });
    setSending(false);
    if (!error) setBody("");
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Shoutbox</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> live
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{messages.length} recent</span>
      </header>

      <ul className="max-h-72 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-muted-foreground">Be the first to post in the shoutbox.</li>
        )}
        {messages.map((m) => (
          <li key={m.id} className="rounded-md border border-border/50 bg-background/40 px-3 py-2 text-xs">
            <div className="mb-0.5 flex items-center gap-2">
              <span className="font-semibold text-foreground">{m.display_name}</span>
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
            </div>
            <p className="break-words text-foreground/90">{m.body}</p>
          </li>
        ))}
      </ul>

      <Separator />
      <div className="p-3">
        {user ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={`Say something as ${displayName}…`}
              maxLength={500} rows={2}
              className="min-h-0 resize-none text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <Button onClick={send} disabled={sending || !body.trim()} size="sm" className="gap-1">
              <Send className="h-3.5 w-3.5" /> Post
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Sign in to chat with the community.</span>
            <Button asChild size="sm" variant="outline"><Link to="/auth">Sign in</Link></Button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────── Tips widget ───────────────── */
const TIPS = [
  "Always release escrow only after fiat clears your account — not just an SMS confirmation.",
  "Re-check the seller's wallet address character-by-character before releasing.",
  "Use the mediator bot in any open trade to summon a human moderator within minutes.",
  "BIN listings show masked card metadata — buyers see full details only after escrow funds settle.",
];
function TipsWidget() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % TIPS.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-warning/40 bg-warning/10 text-warning">
        <Lightbulb className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80">Trade Tip</h3>
        <p className="mt-1 text-xs leading-relaxed text-foreground/90">{TIPS[i]}</p>
      </div>
    </section>
  );
}

/* ───────────────── User dashboard sidebar ───────────────── */
function UserDashboard() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["landing-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,avatar_url,trades_completed")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  if (!user) {
    return (
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-center">
        <span className="grid h-12 w-12 mx-auto place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-semibold">Join the community</h3>
        <p className="mt-1 text-xs text-muted-foreground">Sign in to track trades, chat in the shoutbox and manage your wallet.</p>
        <Button asChild size="sm" className="mt-3 w-full"><Link to="/auth">Sign in / Sign up</Link></Button>
      </section>
    );
  }
  const name = profile?.display_name || user.email?.split("@")[0] || "Trader";
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/40 bg-primary/10 text-sm font-semibold text-primary">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Trades" value={profile?.trades_completed ?? 0} />
        <Stat label="Member" value={"✓"} />
      </div>
      <Button asChild variant="outline" size="sm" className="mt-3 w-full"><Link to="/transactions">My transactions</Link></Button>
    </section>
  );
}
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ───────────────── Wallet card ───────────────── */
function WalletCard() {
  const { user } = useAuth();
  const { data: wallet } = useQuery({
    queryKey: ["landing-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("asset,available,escrow")
        .eq("user_id", user!.id)
        .eq("asset", "BTC")
        .maybeSingle();
      return data;
    },
  });
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">My Wallet</h3>
        </div>
        <Link to="/wallet" className="text-[11px] text-muted-foreground hover:text-foreground">Manage →</Link>
      </header>
      <div className="space-y-2">
        <Row label="BTC available" value={user ? (wallet?.available ?? 0).toString() : "—"} />
        <Row label="In escrow" value={user ? (wallet?.escrow ?? 0).toString() : "—"} />
      </div>
      {!user && (
        <Button asChild size="sm" variant="outline" className="mt-3 w-full"><Link to="/auth">Sign in to fund</Link></Button>
      )}
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums font-semibold">{value}</span>
    </div>
  );
}

/* ───────────────── Resources feed (latest products by category) ───────────────── */
function ResourcesFeed() {
  const { data } = useQuery({
    queryKey: ["landing", "resources"],
    queryFn: () => listProducts({ data: {} as never }),
    staleTime: 30_000,
  });
  const rows = (data?.products ?? []).slice(0, 6);
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-4">
      <header className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">New Resources</h3>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing posted yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => {
            const cat = MARKETPLACE_CATEGORIES.find((c) => c.value === p.category);
            return (
              <li key={p.id}>
                <Link to="/product/$id" params={{ id: p.id }} className={cn(
                  "block rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5",
                )}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase text-primary/80">{cat?.value ?? p.category}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    ${Number(p.price).toFixed(2)} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
