import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bitcoin, Lock, Wallet as WalletIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fmtCrypto } from "@/lib/format";

/**
 * Compact, user-scoped live balance strip. Shows ONLY the signed-in user's
 * own internal wallet balances (RLS-scoped) — never treasury data.
 */
export function MyBalanceStrip({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["my-wallet-strip", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("asset, available, escrow")
        .eq("user_id", user!.id)
        .eq("asset", "BTC")
        .maybeSingle();
      return data ?? { asset: "BTC", available: 0, escrow: 0 };
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`my-wallet-strip-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-wallet-strip", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const available = Number(data?.available ?? 0);
  const escrow = Number(data?.escrow ?? 0);

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-3" : "sm:grid-cols-3"}`}>
      <Tile icon={<Bitcoin className="h-3.5 w-3.5 text-orange-500" />} label="Available" value={fmtCrypto(available, "BTC")} />
      <Tile icon={<Lock className="h-3.5 w-3.5 text-primary" />} label="In escrow" value={fmtCrypto(escrow, "BTC")} />
      <Tile icon={<WalletIcon className="h-3.5 w-3.5 text-emerald-500" />} label="Total" value={fmtCrypto(available + escrow, "BTC")} />
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-2.5 backdrop-blur">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}
