import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, ShieldCheck, Star, TrendingUp, Ban, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getPublicProfile } from "@/lib/marketplace.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtFiat } from "@/lib/format";

type Sort = "newest" | "active" | "pinned";
type Kind = "all" | "selling" | "seeking";

type ProfileSearch = { sort: Sort; kind: Kind; page: number };

const SORTS: Sort[] = ["newest", "active", "pinned"];
const KINDS: Kind[] = ["all", "selling", "seeking"];

const PAGE_SIZE = 10;

const profileQuery = (userId: string, sort: Sort, kind: Kind, page: number) =>
  queryOptions({
    queryKey: ["public-profile", userId, sort, kind, page],
    queryFn: () => getPublicProfile({ data: { userId, sort, kind, page, pageSize: PAGE_SIZE } }),
  });

export const Route = createFileRoute("/u/$userId")({
  validateSearch: (raw: Record<string, unknown>): ProfileSearch => ({
    sort: SORTS.includes(raw.sort as Sort) ? (raw.sort as Sort) : "pinned",
    kind: KINDS.includes(raw.kind as Kind) ? (raw.kind as Kind) : "all",
    page: Math.max(1, Number(raw.page) || 1),
  }),
  loaderDeps: ({ search }) => ({ sort: search.sort, kind: search.kind, page: search.page }),
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureQueryData(profileQuery(params.userId, deps.sort, deps.kind, deps.page)),
  head: ({ params }) => ({
    meta: [
      { title: `User profile · EscrowDesk` },
      { name: "description", content: `Public profile and active threads for user ${params.userId}` },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="container mx-auto max-w-3xl p-6">
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </p>
      <Link to="/order-book" className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Profile not found.</div>,
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const { sort, kind, page } = Route.useSearch();
  const nav = useNavigate({ from: "/u/$userId" });
  const fetcher = useServerFn(getPublicProfile);
  const { data } = useSuspenseQuery({
    ...profileQuery(userId, sort, kind, page),
    queryFn: () => fetcher({ data: { userId, sort, kind, page, pageSize: PAGE_SIZE } }),
  });
  const p = data.profile;
  const threads = data.threads;
  const totalPages = Math.max(1, Math.ceil((data.totalCount ?? 0) / PAGE_SIZE));
  const initials = (p.display_name || "A").slice(0, 1).toUpperCase();

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <Link to="/order-book" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to threads
      </Link>

      <div className="surface flex flex-col gap-4 p-5 md:flex-row md:items-center">
        {p.avatar_url
          ? <img src={p.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          : <div className="grid h-20 w-20 place-items-center rounded-full bg-secondary text-2xl font-semibold">{initials}</div>}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{p.display_name}</h1>
            {p.is_premium && <Crown className="h-5 w-5 text-amber-400" />}
            {p.is_trusted && !p.is_premium && <ShieldCheck className="h-5 w-5 text-emerald-400" />}
            {p.is_banned && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Banned</Badge>}
            {!p.is_banned && p.suspended_until && new Date(p.suspended_until).getTime() > Date.now() && (
              <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/40">Suspended until {new Date(p.suspended_until).toLocaleDateString()}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {p.rating_avg !== null && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {p.rating_avg.toFixed(2)} <span className="text-muted-foreground/60">({p.rating_count})</span>
              </span>
            )}
            <span>· {p.trades_completed} trades</span>
            {p.btc_volume_usd > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <TrendingUp className="h-3.5 w-3.5" /> {fmtFiat(p.btc_volume_usd, "USD")} volume
              </span>
            )}
            {p.telegram_username && <span>· @{p.telegram_username}</span>}
            <span>· joined {new Date(p.joined_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Threads ({data.totalCount ?? 0})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={kind} onValueChange={(v) => nav({ search: (s) => ({ ...s, kind: v as typeof kind, page: 1 }) })}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="h-6 text-xs">All</TabsTrigger>
                <TabsTrigger value="selling" className="h-6 text-xs">Selling</TabsTrigger>
                <TabsTrigger value="seeking" className="h-6 text-xs">Seeking</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={sort} onValueChange={(v) => nav({ search: (s) => ({ ...s, sort: v as typeof sort, page: 1 }) })}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pinned">Pinned first</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="active">Most active</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {threads.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            No threads to show.
          </p>
        ) : (
          <div className="surface divide-y divide-border/40">
            {threads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                {t.is_pinned && <span className="text-amber-400">📌</span>}
                <span className="flex-1 truncate font-medium">{t.name}</span>
                <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                <span className="font-mono text-primary">
                  {t.amount != null ? fmtFiat(Number(t.amount), t.currency || "USD") : "—"}
                </span>
                <Badge variant={t.kind === "selling" ? "default" : "secondary"} className="text-[9px]">
                  {t.kind === "selling" ? "Sell" : "Buy"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1}
                onClick={() => nav({ search: (s) => ({ ...s, page: page - 1 }) })}>
                <ChevronLeft className="h-3 w-3" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages}
                onClick={() => nav({ search: (s) => ({ ...s, page: page + 1 }) })}>
                Next <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
