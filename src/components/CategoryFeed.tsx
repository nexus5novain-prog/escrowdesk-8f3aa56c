import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ShieldCheck, Loader2, Pin, Star } from "lucide-react";
import { listCategoryThreads, type CategoryThread } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { fmtFiat } from "@/lib/format";

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export function CategoryFeed({ section }: { section: string }) {
  const fetchThreads = useServerFn(listCategoryThreads);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["category-threads", section],
    queryFn: () => fetchThreads({ data: { section } }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["category-threads", section] });
    const ch = supabase
      .channel(`cat-feed-${section}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, section]);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }
  const threads = data?.threads ?? [];
  if (!threads.length) {
    return <p className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">No active threads in this category yet.</p>;
  }
  return (
    <div className="surface overflow-hidden">
      <div className="grid grid-cols-12 gap-2 border-b border-border/60 bg-secondary/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <div className="col-span-5 md:col-span-4">Thread</div>
        <div className="col-span-3 hidden md:block">Author</div>
        <div className="col-span-3 md:col-span-2">Category</div>
        <div className="col-span-2 md:col-span-1">Price</div>
        <div className="col-span-1">Type</div>
        <div className="col-span-1 hidden md:block">Posted</div>
      </div>
      <div className="max-h-[520px] divide-y divide-border/40 overflow-y-auto">
        <AnimatePresence initial={false}>
          {threads.map((t) => <Row key={t.id} t={t} />)}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ t }: { t: CategoryThread }) {
  const sub = t.category.includes("·") ? t.category.split("·").slice(1).join("·").trim() : t.category;
  const initials = (t.author || "A").slice(0, 1).toUpperCase();
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`grid grid-cols-12 items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/30 ${t.is_pinned ? "bg-primary/5" : ""}`}
    >
      <div className="col-span-5 truncate font-medium md:col-span-4 flex items-center gap-1.5">
        {t.is_pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
        <span className="truncate">{t.name}</span>
      </div>
      <Link
        to="/u/$userId" search={{}}
        params={{ userId: t.user_id }}
        className="col-span-3 hidden items-center gap-1.5 truncate text-muted-foreground md:flex hover:text-foreground"
      >
        {t.avatar_url
          ? <img src={t.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[9px] font-semibold">{initials}</span>}
        {t.is_premium && <Crown className="h-3 w-3 shrink-0 text-amber-400" />}
        {t.is_trusted && !t.is_premium && <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400" />}
        <span className="truncate">{t.author}</span>
        {t.rating_avg !== null && (
          <span className="flex shrink-0 items-center gap-0.5 text-[10px]">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{t.rating_avg.toFixed(1)}
          </span>
        )}
      </Link>
      <div className="col-span-3 truncate text-muted-foreground md:col-span-2">{sub}</div>
      <div className="col-span-2 font-mono text-primary md:col-span-1">
        {t.amount != null ? fmtFiat(Number(t.amount), t.currency || "USD") : "—"}
      </div>
      <div className="col-span-1">
        <Badge variant={t.kind === "selling" ? "default" : "secondary"} className="text-[9px]">
          {t.kind === "selling" ? "Sell" : "Buy"}
        </Badge>
      </div>
      <div className="col-span-1 hidden font-mono text-[10px] text-muted-foreground md:block">{fmtDate(t.created_at)}</div>
    </motion.div>
  );
}
