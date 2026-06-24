import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bitcoin, Zap, Lock, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Copy, Activity, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtFiat } from "@/lib/format";
import { getMyWallet, listMyLedger, listMyDeposits, createBtcDeposit, createLightningDeposit } from "@/lib/wallet-deposits.functions";
import { listMyWithdrawals, requestWithdrawal, cancelWithdrawal } from "@/lib/wallet-withdrawals.functions";

const SATS_PER_BTC = 100_000_000;
const fmtSats = (s: number | null | undefined) =>
  ((Number(s ?? 0)) / SATS_PER_BTC).toFixed(8) + " BTC";

export const Route = createFileRoute("/wallet")({ component: () => (<AuthGate><Wallet /></AuthGate>) });

function Wallet() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const getWallet = useServerFn(getMyWallet);
  const getLedger = useServerFn(listMyLedger);
  const getDeposits = useServerFn(listMyDeposits);
  const getWithdrawals = useServerFn(listMyWithdrawals);

  const { data: wallet } = useQuery({ queryKey: ["my-wallet"], queryFn: () => getWallet(), refetchInterval: 30_000 });
  const { data: ledger } = useQuery({ queryKey: ["my-ledger"], queryFn: () => getLedger({ data: { limit: 50 } }) });
  const { data: deposits } = useQuery({ queryKey: ["my-deposits"], queryFn: () => getDeposits() });
  const { data: withdrawals } = useQuery({ queryKey: ["my-withdrawals"], queryFn: () => getWithdrawals() });

  // BTC/USD rate
  const { data: rate } = useQuery({
    queryKey: ["btc-rate"],
    queryFn: async () => {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
      const j = await r.json() as { bitcoin?: { usd?: number } };
      return j.bitcoin?.usd ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Realtime: any ledger / deposit / withdrawal change for this user → refetch everything
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`wallet-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_entries", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["my-wallet"] });
          qc.invalidateQueries({ queryKey: ["my-ledger"] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-deposits"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-withdrawals"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const totalSats =
    Number(wallet?.available_sats ?? 0) +
    Number(wallet?.locked_escrow_sats ?? 0) +
    Number(wallet?.pending_deposit_sats ?? 0) +
    Number(wallet?.pending_withdrawal_sats ?? 0);
  const totalUsd = (totalSats / SATS_PER_BTC) * (rate ?? 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <WalletIcon className="h-3.5 w-3.5" /> Custodial wallet
            </div>
            <p className="mt-1 font-mono text-sm text-primary">{wallet?.wallet_code ?? "WAL-…"}</p>
            <h1 className="mt-2 font-mono text-4xl font-bold tabular-nums">{fmtFiat(totalUsd, "USD")}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{fmtSats(totalSats)} · 1 BTC = {fmtFiat(rate ?? 0, "USD")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/portfolio"><Button variant="outline" size="sm">How escrow works</Button></Link>
            <Link to="/trades"><Button variant="outline" size="sm">My trades</Button></Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <BucketTile icon={<WalletIcon className="h-3.5 w-3.5 text-emerald-500" />} label="Available" sats={Number(wallet?.available_sats ?? 0)} rate={rate ?? 0} />
          <BucketTile icon={<Lock className="h-3.5 w-3.5 text-primary" />} label="In escrow" sats={Number(wallet?.locked_escrow_sats ?? 0)} rate={rate ?? 0} />
          <BucketTile icon={<ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />} label="Pending deposits" sats={Number(wallet?.pending_deposit_sats ?? 0)} rate={rate ?? 0} />
          <BucketTile icon={<ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500" />} label="Pending withdrawals" sats={Number(wallet?.pending_withdrawal_sats ?? 0)} rate={rate ?? 0} />
        </div>
      </Card>

      <Tabs defaultValue="deposit">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="deposit"><ArrowDownToLine className="mr-1 h-3.5 w-3.5" /> Deposit</TabsTrigger>
          <TabsTrigger value="withdraw"><ArrowUpFromLine className="mr-1 h-3.5 w-3.5" /> Withdraw</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-1 h-3.5 w-3.5" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="mt-4 space-y-4">
          <DepositPanel onCreated={() => qc.invalidateQueries({ queryKey: ["my-deposits"] })} />
          <DepositList rows={deposits ?? []} />
        </TabsContent>

        <TabsContent value="withdraw" className="mt-4 space-y-4">
          <WithdrawPanel availableSats={Number(wallet?.available_sats ?? 0)} onCreated={() => {
            qc.invalidateQueries({ queryKey: ["my-withdrawals"] });
            qc.invalidateQueries({ queryKey: ["my-wallet"] });
          }} />
          <WithdrawList rows={withdrawals ?? []} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <LedgerFeed rows={ledger ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BucketTile({ icon, label, sats, rate }: { icon: React.ReactNode; label: string; sats: number; rate: number }) {
  const usd = (sats / SATS_PER_BTC) * rate;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 backdrop-blur">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <p className="mt-1.5 font-mono text-base font-semibold tabular-nums">{fmtSats(sats)}</p>
      <p className="text-[11px] text-muted-foreground">{fmtFiat(usd, "USD")}</p>
    </div>
  );
}

function DepositPanel({ onCreated }: { onCreated: () => void }) {
  const createBtc = useServerFn(createBtcDeposit);
  const createLn = useServerFn(createLightningDeposit);
  const [lnSats, setLnSats] = useState("10000");
  const [btcAddr, setBtcAddr] = useState<{ address: string; expires_at: string } | null>(null);
  const [lnInv, setLnInv] = useState<{ bolt11: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState<"btc" | "ln" | null>(null);

  const newBtcAddress = async () => {
    setBusy("btc");
    try { const r = await createBtc({ data: {} }); setBtcAddr({ address: r.address, expires_at: r.expires_at }); onCreated(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const newLnInvoice = async () => {
    const sats = Number(lnSats);
    if (!sats || sats <= 0) return toast.error("Enter sats amount");
    setBusy("ln");
    try { const r = await createLn({ data: { amount_sats: sats } }); setLnInv({ bolt11: r.bolt11, expires_at: r.expires_at }); onCreated(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-2"><Bitcoin className="h-4 w-4 text-orange-500" /><h3 className="font-semibold">Bitcoin (on-chain)</h3></div>
        <p className="mt-1 text-xs text-muted-foreground">Generate a fresh deposit address. Funds credit your wallet after 1 confirmation.</p>
        <Button className="mt-3" size="sm" onClick={newBtcAddress} disabled={busy === "btc"}>
          {busy === "btc" ? "Generating…" : "Generate address"}
        </Button>
        {btcAddr && (
          <div className="mt-4 rounded-md border border-border/60 bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Send Bitcoin to</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all font-mono text-xs">{btcAddr.address}</code>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(btcAddr.address); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Expires {new Date(btcAddr.expires_at).toLocaleString()}</p>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-400" /><h3 className="font-semibold">Lightning</h3></div>
        <p className="mt-1 text-xs text-muted-foreground">Instant deposits. Enter the amount you want to receive (sats).</p>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount (sats)</Label>
            <Input value={lnSats} onChange={(e) => setLnSats(e.target.value)} type="number" min="1" />
          </div>
          <Button size="sm" onClick={newLnInvoice} disabled={busy === "ln"}>
            {busy === "ln" ? "Creating…" : "Create invoice"}
          </Button>
        </div>
        {lnInv && (
          <div className="mt-4 rounded-md border border-border/60 bg-secondary/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pay this Lightning invoice</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate font-mono text-xs">{lnInv.bolt11}</code>
              <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(lnInv.bolt11); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">Expires {new Date(lnInv.expires_at).toLocaleString()}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function WithdrawPanel({ availableSats, onCreated }: { availableSats: number; onCreated: () => void }) {
  const req = useServerFn(requestWithdrawal);
  const [method, setMethod] = useState<"btc_onchain" | "lightning">("btc_onchain");
  const [dest, setDest] = useState("");
  const [sats, setSats] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = Number(sats);
    if (!n || n <= 0) return toast.error("Enter amount");
    if (n > availableSats) return toast.error("Exceeds available balance");
    if (!dest.trim()) return toast.error("Enter destination");
    setBusy(true);
    try {
      const r = await req({ data: { method, amount_sats: n, destination: dest.trim() } });
      toast.success(r.requires_approval ? "Submitted for admin review" : "Withdrawal approved");
      setDest(""); setSats("");
      onCreated();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-amber-500" /><h3 className="font-semibold">Withdraw funds</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">
        Funds move to <em>pending withdrawal</em> while we verify. Withdrawals ≥ $500 USD require admin approval.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</Label>
          <div className="mt-1 flex rounded-md border border-border/60 p-1">
            <button type="button" onClick={() => setMethod("btc_onchain")}
              className={`flex-1 rounded px-2 py-1 text-xs ${method === "btc_onchain" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              <Bitcoin className="mr-1 inline h-3 w-3" /> BTC
            </button>
            <button type="button" onClick={() => setMethod("lightning")}
              className={`flex-1 rounded px-2 py-1 text-xs ${method === "lightning" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              <Zap className="mr-1 inline h-3 w-3" /> LN
            </button>
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount (sats)</Label>
          <Input value={sats} onChange={(e) => setSats(e.target.value)} type="number" min="1" placeholder="50000" />
        </div>
        <div className="flex items-end">
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit"}</Button>
        </div>
      </div>
      <div className="mt-3">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {method === "btc_onchain" ? "Destination BTC address" : "Lightning invoice (bolt11)"}
        </Label>
        <Input value={dest} onChange={(e) => setDest(e.target.value)}
          placeholder={method === "btc_onchain" ? "bc1q…" : "lnbc…"} className="font-mono text-xs" />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Available: {fmtSats(availableSats)}
      </p>
    </Card>
  );
}

function DepositList({ rows }: { rows: Array<{ id: string; method: string; status: string; amount_sats: number | null; destination: string; confirmations: number; created_at: string }> }) {
  if (rows.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deposits</h3>
      <ul className="divide-y divide-border/40">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {r.method === "lightning" ? <Zap className="h-3.5 w-3.5 text-yellow-400" /> : <Bitcoin className="h-3.5 w-3.5 text-orange-500" />}
              <div>
                <p className="font-mono text-xs">{r.destination.slice(0, 24)}…</p>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className="text-[10px] uppercase">{r.status}</Badge>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{r.amount_sats ? fmtSats(r.amount_sats) : "any"}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function WithdrawList({ rows }: { rows: Array<{ id: string; method: string; status: string; amount_sats: number; destination: string; risk_score: number; created_at: string }> }) {
  const cancel = useServerFn(cancelWithdrawal);
  const qc = useQueryClient();
  const handleCancel = async (id: string) => {
    try { await cancel({ data: { id } }); toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["my-withdrawals"] }); qc.invalidateQueries({ queryKey: ["my-wallet"] }); }
    catch (e) { toast.error((e as Error).message); }
  };
  if (rows.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Withdrawals</h3>
      <ul className="divide-y divide-border/40">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {r.method === "lightning" ? <Zap className="h-3.5 w-3.5 text-yellow-400" /> : <Bitcoin className="h-3.5 w-3.5 text-orange-500" />}
              <div>
                <p className="font-mono text-xs">{r.destination.slice(0, 28)}…</p>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · risk {r.risk_score}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <Badge variant="secondary" className="text-[10px] uppercase">{r.status.replace(/_/g, " ")}</Badge>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{fmtSats(r.amount_sats)}</p>
              </div>
              {(r.status === "pending_review" || r.status === "approved") && (
                <Button size="sm" variant="ghost" onClick={() => handleCancel(r.id)}>Cancel</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LedgerFeed({ rows }: { rows: Array<{ id: string; kind: string; direction: string; bucket: string; amount_sats: number; created_at: string }> }) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Clock className="mx-auto mb-2 h-6 w-6 opacity-50" />
        No activity yet. Deposit some Bitcoin to get started.
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <ul className="divide-y divide-border/40">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <KindIcon kind={r.kind} direction={r.direction} />
              <div>
                <p className="text-xs font-medium">{prettyKind(r.kind)}</p>
                <p className="text-[10px] text-muted-foreground">{r.bucket.replace(/_/g, " ")} · {new Date(r.created_at).toLocaleString()}</p>
              </div>
            </div>
            <p className={`font-mono text-sm ${r.direction === "credit" ? "text-emerald-500" : "text-rose-500"}`}>
              {r.direction === "credit" ? "+" : "−"}{fmtSats(r.amount_sats)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function KindIcon({ kind, direction }: { kind: string; direction: string }) {
  if (kind === "deposit") return <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />;
  if (kind === "withdrawal") return <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500" />;
  if (kind.startsWith("escrow")) return <Lock className="h-3.5 w-3.5 text-primary" />;
  if (kind === "refund") return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />;
  if (kind === "fee") return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}
function prettyKind(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
