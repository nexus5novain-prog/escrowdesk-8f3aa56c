import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bitcoin, Zap, Shield, CheckCircle2, XCircle, Send, AlertTriangle, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { adminListWithdrawals, adminApproveWithdrawal, adminRejectWithdrawal, adminMarkWithdrawalPaid } from "@/lib/wallet-admin.functions";

const SATS_PER_BTC = 100_000_000;
const fmtBtc = (s: number) => (s / SATS_PER_BTC).toFixed(8);
const fmtAddr = (s: string) => s.length > 22 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s;
const fmtAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m/60)}h ago`; return `${Math.floor(m/1440)}d ago`;
};

type WithdrawalRow = Awaited<ReturnType<typeof adminListWithdrawals>>[number];

export function WithdrawalsPanel() {
  const [tab, setTab] = useState<"pending_review"|"approved"|"rejected"|"sent"|"all">("pending_review");
  const fetchList = useServerFn(adminListWithdrawals);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", tab],
    queryFn: () => fetchList({ data: { status: tab } }),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Withdrawal approvals</h2>
          <p className="text-xs text-muted-foreground">Single admin sign-off under $2,000 · two admins required at $2,000+</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending_review">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="sent">Paid</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && (data ?? []).length === 0 && (
            <div className="surface p-6 text-center text-sm text-muted-foreground">No withdrawals in this status.</div>
          )}
          {(data ?? []).map((w) => <WithdrawalCard key={w.id} w={w} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WithdrawalCard({ w }: { w: WithdrawalRow }) {
  const qc = useQueryClient();
  const approve = useServerFn(adminApproveWithdrawal);
  const reject = useServerFn(adminRejectWithdrawal);
  const markPaid = useServerFn(adminMarkWithdrawalPaid);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [paidOpen, setPaidOpen] = useState(false);
  const [txHash, setTxHash] = useState("");

  const meta = (w.metadata ?? {}) as { usd?: number };
  const usd = Number(meta.usd ?? 0);
  const isHighValue = usd >= 2000;
  const approvals = w.approvals.filter((a) => a.action === "approve");
  const need = isHighValue ? 2 : 1;
  const risk = w.risk_score ?? 0;
  const profile = w.profile;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });

  const onApprove = async () => {
    setBusy(true);
    try { await approve({ data: { id: w.id } }); toast.success("Approval recorded"); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const onReject = async () => {
    if (reason.trim().length < 3) return toast.error("Reason required");
    setBusy(true);
    try { await reject({ data: { id: w.id, reason } }); toast.success("Withdrawal rejected, funds refunded"); setRejectOpen(false); setReason(""); refresh(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const onMarkPaid = async () => {
    if (!txHash.trim()) return toast.error("tx hash / payment hash required");
    setBusy(true);
    try {
      const payload = w.method === "lightning" ? { id: w.id, payment_hash: txHash } : { id: w.id, tx_hash: txHash };
      await markPaid({ data: payload });
      toast.success("Marked as paid; balance debited"); setPaidOpen(false); setTxHash(""); refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {w.method === "lightning" ? <Zap className="h-4 w-4 text-yellow-500" /> : <Bitcoin className="h-4 w-4 text-orange-500" />}
            <span className="font-mono text-base font-semibold">{fmtBtc(w.amount_sats)} BTC</span>
            {usd > 0 && <span className="text-xs text-muted-foreground">≈ ${usd.toFixed(2)}</span>}
            <StatusBadge status={w.status} />
            {isHighValue && <Badge variant="outline" className="border-amber-500/40 text-amber-600">High value · 2 admins</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{profile?.display_name ?? w.user_id.slice(0, 8)}</span>
            {profile?.is_trusted && <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">Trusted</Badge>}
            {profile?.is_premium && <Badge variant="outline" className="border-violet-500/30 text-violet-600">Premium</Badge>}
            {profile?.is_banned && <Badge variant="destructive">Banned</Badge>}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtAgo(w.created_at)}</span>
          </div>
        </div>
        <RiskBadge score={risk} />
      </div>

      <div className="rounded-md border border-border/40 bg-background/40 p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Destination</div>
        <code className="break-all text-xs">{fmtAddr(w.destination)}</code>
      </div>

      {approvals.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-emerald-500" />
          {approvals.length}/{need} admin approvals · {approvals.map((a) => a.admin_id.slice(0, 6)).join(", ")}
        </div>
      )}
      {w.rejected_reason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <span className="font-semibold text-destructive">Rejected:</span> {w.rejected_reason}
        </div>
      )}
      {(w.tx_hash || w.payment_hash) && (
        <div className="text-xs text-muted-foreground">
          {w.tx_hash ? "tx" : "payment_hash"}: <code className="break-all">{w.tx_hash ?? w.payment_hash}</code>
        </div>
      )}

      {/* Actions */}
      {(w.status === "pending_review" || w.status === "approved") && (
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          {w.status !== "approved" || approvals.length < need ? (
            <Button size="sm" onClick={onApprove} disabled={busy}>
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {isHighValue && approvals.length === 0 ? "Approve (1 of 2)" : isHighValue ? "Approve (2 of 2)" : "Approve"}
            </Button>
          ) : null}
          {w.status === "approved" && (
            <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="mr-1 h-4 w-4" /> Mark paid
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark withdrawal as paid</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  This will debit {fmtBtc(w.amount_sats)} BTC from the user's pending_withdrawal balance.
                  Make sure the funds have actually left BTCPay / LND before confirming.
                </p>
                <Input
                  placeholder={w.method === "lightning" ? "payment hash" : "tx hash"}
                  value={txHash} onChange={(e) => setTxHash(e.target.value)} />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPaidOpen(false)}>Cancel</Button>
                  <Button onClick={onMarkPaid} disabled={busy}>Confirm paid</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive"><XCircle className="mr-1 h-4 w-4" /> Reject</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Reject withdrawal</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                {fmtBtc(w.amount_sats)} BTC will be refunded to the user's available balance.
              </p>
              <Textarea placeholder="Reason (shown to user)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={onReject} disabled={busy}>Reject &amp; refund</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_review: { label: "Pending review", cls: "border-amber-500/40 text-amber-600" },
    approved:       { label: "Approved",       cls: "border-sky-500/40 text-sky-600" },
    rejected:       { label: "Rejected",       cls: "border-destructive/40 text-destructive" },
    processing:     { label: "Processing",     cls: "border-violet-500/40 text-violet-600" },
    sent:           { label: "Paid",           cls: "border-emerald-500/40 text-emerald-600" },
    failed:         { label: "Failed",         cls: "border-destructive/40 text-destructive" },
    cancelled:      { label: "Cancelled",      cls: "border-muted-foreground/40 text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function RiskBadge({ score }: { score: number }) {
  const cls = score >= 60 ? "border-destructive/50 text-destructive" : score >= 30 ? "border-amber-500/50 text-amber-600" : "border-emerald-500/50 text-emerald-600";
  const label = score >= 60 ? "High risk" : score >= 30 ? "Medium" : "Low";
  return (
    <Badge variant="outline" className={cls}>
      <AlertTriangle className="mr-1 h-3 w-3" /> {label} ({score})
    </Badge>
  );
}
