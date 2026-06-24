import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, ShieldCheck, Star, TrendingUp, Ban, ArrowLeft } from "lucide-react";
import { getPublicProfile } from "@/lib/marketplace.functions";
import { Badge } from "@/components/ui/badge";
import { fmtFiat } from "@/lib/format";

const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["public-profile", userId],
    queryFn: () => getPublicProfile({ data: { userId } }),
  });

export const Route = createFileRoute("/u/$userId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(profileQuery(params.userId)),
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
  const fetcher = useServerFn(getPublicProfile);
  const { data } = useSuspenseQuery({
    ...profileQuery(userId),
    queryFn: () => fetcher({ data: { userId } }),
  });
  const p = data.profile;
  const threads = data.threads;
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active threads ({threads.length})
        </h2>
        {threads.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            No active threads.
          </p>
        ) : (
          <div className="surface divide-y divide-border/40">
            {threads.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-xs">
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
      </section>
    </div>
  );
}
