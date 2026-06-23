import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Star, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { listApprovedShouts, type ShoutMsg } from "@/lib/shoutbox.functions";
import { supabase } from "@/integrations/supabase/client";

/** Small inline shoutbox card that picks one approved shout at random.
 *  Mounted globally so every page surfaces at least one community shoutout. */
export function RandomShout({ className = "" }: { className?: string }) {
  const fn = useServerFn(listApprovedShouts);
  const { data, refetch } = useQuery({
    queryKey: ["random-shout"],
    queryFn: () => fn({ data: { limit: 25 } }),
    staleTime: 30_000,
  });
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const ch = supabase.channel("random-shout-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shoutbox_messages" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  const msgs = (data?.messages ?? []) as ShoutMsg[];
  useEffect(() => {
    if (msgs.length <= 1) return;
    setIdx(Math.floor(Math.random() * msgs.length));
    const t = setInterval(() => setIdx(Math.floor(Math.random() * msgs.length)), 12_000);
    return () => clearInterval(t);
  }, [msgs.length]);

  if (msgs.length === 0) return null;
  const m = msgs[idx % msgs.length];
  return (
    <div className={`mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-primary/30 bg-card/70 px-4 py-2.5 text-xs shadow-sm ${className}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
        <Megaphone className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">{m.display_name}</span>
          {m.is_premium && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
          {!m.is_premium && m.is_trusted && <ShieldCheck className="h-3 w-3 text-emerald-400" />}
          <span className="font-mono text-[10px] uppercase text-muted-foreground">shoutbox</span>
          <span className="text-[10px] text-muted-foreground">· {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 break-words text-foreground/90">{m.body}</p>
      </div>
    </div>
  );
}
