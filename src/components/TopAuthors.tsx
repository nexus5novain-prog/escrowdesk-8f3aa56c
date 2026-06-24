import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Crown, ShieldCheck, Star, TrendingUp, Loader2 } from "lucide-react";
import { listTopAuthors, type TopAuthor } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { fmtFiat } from "@/lib/format";


export function TopAuthors() {
  const fetchAuthors = useServerFn(listTopAuthors);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["top-authors"],
    queryFn: () => fetchAuthors(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["top-authors"] });
    const ch = supabase
      .channel("top-authors-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);


  if (isLoading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  const authors = data?.authors ?? [];
  if (!authors.length) {
    return <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">No authors with active threads yet.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {authors.map((a, i) => <AuthorCard key={a.user_id} a={a} rank={i + 1} />)}
    </div>
  );
}

function AuthorCard({ a, rank }: { a: TopAuthor; rank: number }) {
  const rating = a.rating_count > 0 ? (a.rating_sum / a.rating_count).toFixed(1) : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="surface flex items-start gap-3 p-3"
    >
      <div className="relative shrink-0">
        {a.avatar_url ? (
          <img src={a.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-sm font-semibold">
            {a.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-mono font-bold text-primary-foreground">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate font-medium">{a.display_name}</span>
          {a.is_premium && <Crown className="h-3.5 w-3.5 text-amber-400" />}
          {a.is_trusted && !a.is_premium && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge variant="secondary" className="font-mono text-[10px]">{a.active_threads} threads</Badge>
          <span>· {a.selling_count}S / {a.seeking_count}B</span>
          {rating && <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{rating}</span>}
          <span>· {a.trades_completed} trades</span>
        </div>
        {a.btc_volume_usd > 0 && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-primary">
            <TrendingUp className="h-3 w-3" /> {fmtFiat(a.btc_volume_usd, "USD")} BTC volume
          </div>
        )}
      </div>
    </motion.div>
  );
}
