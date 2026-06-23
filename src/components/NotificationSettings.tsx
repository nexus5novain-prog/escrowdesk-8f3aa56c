import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMyNotificationPrefs,
  updateNotificationPref,
} from "@/lib/notifications.functions";

const LABELS: Record<string, string> = {
  escrow_invoice_created: "Escrow invoice created",
  escrow_payment_detected: "Escrow payment detected",
  escrow_settled: "Escrow funded (settled)",
  escrow_expired: "Escrow invoice expired",
  trade_signed: "Trade terms signed",
  trade_paid: "Trade marked as paid",
  trade_released: "Trade released",
  trade_cancelled: "Trade cancelled",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  arbitration_update: "Arbitration update",
  wallet_credit: "Wallet credit",
  wallet_debit: "Wallet debit",
  admin_warning: "Admin warning",
  admin_ban: "Admin ban",
  system: "System messages",
};

const GROUPS: { name: string; kinds: string[] }[] = [
  { name: "Escrow & Payments", kinds: ["escrow_invoice_created", "escrow_payment_detected", "escrow_settled", "escrow_expired"] },
  { name: "Trades", kinds: ["trade_signed", "trade_paid", "trade_released", "trade_cancelled"] },
  { name: "Disputes & Arbitration", kinds: ["dispute_opened", "dispute_resolved", "arbitration_update"] },
  { name: "Wallet", kinds: ["wallet_credit", "wallet_debit"] },
  { name: "Admin & Moderation", kinds: ["admin_warning", "admin_ban", "system"] },
];

export function NotificationSettings() {
  const get = useServerFn(getMyNotificationPrefs);
  const upd = useServerFn(updateNotificationPref);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notif-prefs"], queryFn: () => get() });

  const setPref = async (kind: string, patch: { in_app?: boolean; telegram?: boolean }) => {
    const cur = data?.prefs.find((p) => p.kind === kind);
    await upd({ data: {
      kind: kind as never,
      in_app: patch.in_app ?? cur?.in_app ?? true,
      telegram: patch.telegram ?? cur?.telegram ?? true,
    } });
    qc.invalidateQueries({ queryKey: ["notif-prefs"] });
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  const byKind = new Map((data?.prefs ?? []).map((p) => [p.kind, p]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Notification preferences</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Choose which events you receive in-app (bell icon) and via Telegram. Telegram requires a linked account.
      </p>

      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/60 bg-secondary/30 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Event</span>
          <span className="flex items-center gap-1"><Bell className="h-3 w-3" /> In-app</span>
          <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Telegram</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.name}>
            <div className="bg-background/50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</div>
            {g.kinds.map((k) => {
              const p = byKind.get(k);
              return (
                <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border/40 px-4 py-2.5 text-sm">
                  <span>{LABELS[k] ?? k}</span>
                  <Switch checked={p?.in_app ?? true} onCheckedChange={(v) => setPref(k, { in_app: v })} />
                  <Switch checked={p?.telegram ?? true} onCheckedChange={(v) => setPref(k, { telegram: v })} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
