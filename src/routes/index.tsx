import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
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
import { listApprovedShouts, reportShout, type ShoutMsg as ShoutMessage } from "@/lib/shoutbox.functions";
import { ShoutboxComposer } from "@/components/ShoutboxComposer";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck, Search, ArrowRight, Wallet, MessageSquare, Send, Lightbulb,
  Layers, CreditCard, Boxes, ScanLine, Megaphone, Lock, Activity, Trophy, Star, Coins, Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { AnnouncementBanner as AdminAnnouncements } from "@/components/AnnouncementBanner";
import { FreeBinLookup } from "@/components/FreeBinLookup";
import { EscrowWorkflow } from "@/components/EscrowWorkflow";
import { SecurityCompliance } from "@/components/SecurityCompliance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EscrowDesk — Institutional Bitcoin Escrow Platform" },
      { name: "description", content: "EscrowDesk is a secure, mediated escrow platform for Bitcoin transactions between two parties. Multi-sig custody, TOTP-protected releases, and on-chain settlement — built for professionals." },
      { property: "og:title", content: "EscrowDesk — Institutional Bitcoin Escrow Platform" },
      { property: "og:description", content: "Secure, mediated Bitcoin escrow between two parties. Multi-sig custody, TOTP-protected releases, and on-chain settlement — built for professionals." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="space-y-6">
      <Hero />
      <FreeBinLookup />
      <AdBanner placement="under_hero" variant="card" className="block" />
      <AdminAnnouncements />
      <AnnouncementBanner />
      <UniversalSearch />
      <QuickCategories />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6 min-w-0">
          <LatestThreads />
          <AdBanner placement="between_threads" variant="card" className="block" />
          <Shoutbox />
          <AdBanner placement="between_sections" variant="card" className="block" />
          <TipsWidget />
          <AdBanner placement="inline_card" variant="card" className="block" />
        </div>
        <aside className="space-y-6">
          <UserDashboard />
          <AdBanner placement="sidebar_top" variant="sidebar" className="block" />
          <WalletCard />
          <AdBanner placement="sidebar_mid" variant="sidebar" className="block" />
          <AdBanner placement="sidebar_resources" variant="sidebar" className="block" />
          <AdBanner placement="sidebar_bottom" variant="sidebar" className="block" />
        </aside>
      </div>
      <EscrowWorkflow />
      <SecurityCompliance />
      <AdBanner placement="center" variant="card" className="block" />
      <AdBanner placement="floating_corner" className="fixed bottom-4 right-4 z-40 w-64 hidden md:block" dismissable />
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */
type Stat = {
  label: string;
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  display?: string; // overrides numeric formatting
};

function AnimatedNumber({
  to, prefix = "", suffix = "", decimals = 0, display, duration = 2.2,
}: { to: number; prefix?: string; suffix?: string; decimals?: number; display?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const [text, setText] = useState(display ?? `${prefix}0${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (display) {
          // Animate just for effect, then snap to display label
          setText(`${prefix}${latest.toFixed(decimals)}${suffix}`);
        } else {
          const formatted = decimals
            ? latest.toFixed(decimals)
            : Math.floor(latest).toLocaleString();
          setText(`${prefix}${formatted}${suffix}`);
        }
      },
      onComplete: () => {
        if (display) setText(display);
      },
    });
    return () => controls.stop();
  }, [inView, to, duration, prefix, suffix, decimals, display, mv]);

  return <span ref={ref}>{text}</span>;
}

function Hero() {
  const stats: Stat[] = [
    { label: "Protected volume",     to: 2,    prefix: "$",  suffix: "M+" },
    { label: "Successful escrows",   to: 1200, suffix: "+" },
    { label: "Support & mediation",  to: 24,   suffix: "/7", display: "24/7" },
    { label: "Release protection",   to: 2,    suffix: "FA", display: "2FA" },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* Animated ambient glows */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 20, 0], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, -25, 0], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, hsl(var(--primary)) 0, transparent 45%), radial-gradient(circle at 85% 70%, hsl(var(--accent)) 0, transparent 45%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative max-w-3xl"
      >
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground inline-flex items-center gap-2"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live · Institutional Escrow
        </motion.p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-[3.25rem] md:leading-[1.05]">
          {"Trade with Confidence.".split(" ").map((w, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block mr-2"
            >
              {w}
            </motion.span>
          ))}
          <motion.span
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="inline-block bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] bg-clip-text text-transparent animate-[gradientShift_6s_ease_infinite]"
            style={{ backgroundPositionX: "0%" }}
          >
            Settle with Escrow.
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          Secure Bitcoin transactions protected by mediated escrow, multi-signature
          custody, and TOTP-verified releases. Whether you're settling a domain,
          service, vehicle, or digital asset — EscrowDesk keeps both parties
          protected until the deal is complete.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
          className="mt-7 flex flex-wrap items-center gap-3"
        >
          <Button asChild size="lg" className="group gap-2 rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-primary/40">
            <Link to="/escrow">
              <ShieldCheck className="h-4 w-4 transition-transform group-hover:rotate-6" /> Start a Secure Trade
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="group gap-2 rounded-full px-6 transition-all hover:-translate-y-0.5">
            <Link to="/marketplace">
              <Search className="h-4 w-4 transition-transform group-hover:scale-110" /> Explore Marketplace
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="group gap-2 rounded-full px-5">
            <Link to="/auth">
              Create Account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>

      <div className="relative mt-10 border-t border-border/70 pt-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -2 }}
              className="min-w-0 group"
            >
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text">
                <AnimatedNumber
                  to={s.to}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                  display={s.display}
                />
              </dd>
              <p className="mt-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground/80">{s.label}</p>
            </motion.div>
          ))}
        </dl>
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

/* ───────────────── Shoutbox (paid posts, realtime, with poster details) ───────────────── */
function Shoutbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchShouts = useServerFn(listApprovedShouts);
  const { data: payload } = useQuery({
    queryKey: ["shoutbox-approved"],
    queryFn: () => fetchShouts({ data: { limit: 30 } }),
    staleTime: 15_000,
  });
  const messages: ShoutMessage[] = payload?.messages ?? [];

  useEffect(() => {
    const channel = supabase
      .channel("shoutbox-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "shoutbox_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["shoutbox-approved"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const displayName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (meta.display_name as string) || user?.email?.split("@")[0] || "anon";
  }, [user]);

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Shoutbox</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> live
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-warning">
            <Lock className="h-2.5 w-2.5" /> paid
          </span>
        </div>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{messages.length} live</span>
      </header>

      <Separator />
      <div className="p-3">
        {user ? (
          <ShoutboxComposer
            displayName={displayName}
            onPosted={() => qc.invalidateQueries({ queryKey: ["shoutbox-approved"] })}
          />
        ) : (
          <div className="flex items-center justify-between rounded-md border border-dashed border-border/70 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
            <span>Sign in to post a $5 shoutbox.</span>
            <Button asChild size="sm" variant="outline"><Link to="/auth">Sign in</Link></Button>
          </div>
        )}
      </div>
      <Separator />

      <ul className="max-h-96 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <li className="px-2 py-6 text-center text-xs text-muted-foreground">No shoutbox posts yet. Be the first to go viral.</li>
        ) : (
          messages.map((m) => {
            const tierBadge = m.is_premium ? "Premium" : m.is_trusted ? "Trusted" : null;
            return (
              <li
                key={m.id}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  m.is_pinned
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-border/50 bg-background/40",
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.display_name} className="h-5 w-5 shrink-0 rounded-full border border-border/60 object-cover" loading="lazy" />
                  ) : (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-[9px] font-semibold text-primary">
                      {m.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="font-semibold text-foreground">{m.display_name}</span>
                  {tierBadge && (
                    <span className={cn(
                      "rounded-sm px-1 font-mono text-[9px] uppercase",
                      m.is_premium ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400",
                    )}>{tierBadge}</span>
                  )}
                  {m.is_pinned && (
                    <span className="rounded-sm bg-amber-500/20 px-1 font-mono text-[9px] uppercase text-amber-300">📌 Pinned</span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
                  {user && user.id !== m.user_id && <ReportButton id={m.id} />}
                </div>
                <p className="break-words text-foreground/90">{m.body}</p>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

function ReportButton({ id }: { id: string }) {
  const fn = useServerFn(reportShout);
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    const reason = window.prompt("Report this post — why?");
    if (!reason?.trim()) return;
    setBusy(true);
    try { await fn({ data: { id, reason: reason.trim() } }); toast.success("Reported. Staff will review."); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <button
      type="button" onClick={onClick} disabled={busy}
      title="Report"
      className="rounded-sm border border-border/60 bg-background/60 px-1 py-0.5 text-[9px] font-mono uppercase text-muted-foreground hover:border-destructive/60 hover:text-destructive"
    >
      ⚠
    </button>
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
        .from("v_wallet_balances")
        .select("available_sats, locked_escrow_sats")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const available = Number(wallet?.available_sats ?? 0) / 100_000_000;
  const escrow = Number(wallet?.locked_escrow_sats ?? 0) / 100_000_000;
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
        <Row label="BTC available" value={user ? available.toFixed(8) : "—"} />
        <Row label="In escrow" value={user ? escrow.toFixed(8) : "—"} />
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

// ResourcesFeed removed — replaced by `sidebar_resources` ad placement.
