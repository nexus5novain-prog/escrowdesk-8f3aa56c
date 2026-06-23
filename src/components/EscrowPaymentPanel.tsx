import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bitcoin, Zap, Copy, Check, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createEscrowInvoice,
  getEscrowInvoice,
  refreshEscrowInvoice,
} from "@/lib/btcpay.functions";

type Props = { tradeId: string; amountBtc: number };

export function EscrowPaymentPanel({ tradeId, amountBtc }: Props) {
  const qc = useQueryClient();
  const create = useServerFn(createEscrowInvoice);
  const fetchInv = useServerFn(getEscrowInvoice);
  const refresh = useServerFn(refreshEscrowInvoice);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["escrow_invoice", tradeId],
    queryFn: () => fetchInv({ data: { tradeId } }),
    refetchInterval: 6000,
  });

  // Realtime: update on row change
  useEffect(() => {
    const ch = supabase
      .channel(`escrow_invoices:${tradeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "escrow_invoices", filter: `trade_id=eq.${tradeId}` },
        () => qc.invalidateQueries({ queryKey: ["escrow_invoice", tradeId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tradeId, qc]);

  const onCreate = async () => {
    try {
      await create({ data: { tradeId } });
      qc.invalidateQueries({ queryKey: ["escrow_invoice", tradeId] });
      toast.success("Payment destinations generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create invoice");
    }
  };

  const onRefresh = async () => {
    try {
      await refresh({ data: { tradeId } });
      qc.invalidateQueries({ queryKey: ["escrow_invoice", tradeId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
  };

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Loading payment destinations…</Card>;
  }

  if (!invoice) {
    return (
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Fund escrow with Bitcoin</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Generate a unique deposit address and Lightning invoice for this order. Funds are locked in
          escrow until release.
        </p>
        <Button onClick={onCreate} className="w-full">
          Generate payment destinations · {amountBtc.toFixed(8)} BTC
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-orange-500" />
          <h3 className="font-semibold">Fund escrow</h3>
          <StatusBadge status={invoice.status} confs={invoice.confirmations} />
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {invoice.expires_at && invoice.status === "new" && (
        <ExpiryBar expiresAt={invoice.expires_at} />
      )}

      <Tabs defaultValue={invoice.lightning_invoice ? "ln" : "btc"}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="btc"><Bitcoin className="h-3.5 w-3.5 mr-1" /> On-chain</TabsTrigger>
          <TabsTrigger value="ln"><Zap className="h-3.5 w-3.5 mr-1" /> Lightning</TabsTrigger>
        </TabsList>

        <TabsContent value="btc" className="space-y-3 pt-3">
          {invoice.bitcoin_address ? (
            <PaymentDisplay
              uri={`bitcoin:${invoice.bitcoin_address}?amount=${Number(invoice.amount_btc).toFixed(8)}`}
              value={invoice.bitcoin_address}
              label="Bitcoin address"
            />
          ) : (
            <p className="text-sm text-muted-foreground">On-chain not available for this invoice.</p>
          )}
          <ConfirmationProgress confs={invoice.confirmations} status={invoice.status} />
        </TabsContent>

        <TabsContent value="ln" className="space-y-3 pt-3">
          {invoice.lightning_invoice ? (
            <PaymentDisplay
              uri={`lightning:${invoice.lightning_invoice}`}
              value={invoice.lightning_invoice}
              label="Lightning invoice"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Lightning not enabled on this store.</p>
          )}
          <p className="text-xs text-muted-foreground">Lightning settles instantly on payment.</p>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        Amount due: <span className="font-mono">{Number(invoice.amount_btc).toFixed(8)} BTC</span>
        {invoice.paid_amount_btc > 0 && (
          <> · Paid: <span className="font-mono">{Number(invoice.paid_amount_btc).toFixed(8)} BTC</span></>
        )}
      </div>
    </Card>
  );
}

function PaymentDisplay({ uri, value, label }: { uri: string; value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
      <div className="bg-white p-3 rounded">
        <QRCodeSVG value={uri} size={180} includeMargin={false} />
      </div>
      <div className="flex-1 w-full space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="font-mono text-xs break-all bg-muted p-2 rounded select-all">{value}</div>
        <Button size="sm" variant="outline" onClick={copy} className="w-full">
          {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status, confs }: { status: string; confs: number }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "Awaiting payment", cls: "bg-muted text-foreground" },
    processing: { label: `Detected · ${confs}/3 conf`, cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    settled: { label: "Funded ✓", cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
    expired: { label: "Expired", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
    invalid: { label: "Invalid", cls: "bg-red-500/15 text-red-700 dark:text-red-400" },
  };
  const m = map[status] ?? map.new;
  return <Badge className={m.cls} variant="secondary">{m.label}</Badge>;
}

function ConfirmationProgress({ confs, status }: { confs: number; status: string }) {
  if (status === "new") return null;
  const target = 3;
  const pct = Math.min(100, (confs / target) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Confirmations</span>
        <span>{confs} / {target}</span>
      </div>
      <div className="h-1.5 bg-muted rounded overflow-hidden">
        <div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ExpiryBar({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => Math.max(0, +new Date(expiresAt) - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, +new Date(expiresAt) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      Expires in {m}m {s.toString().padStart(2, "0")}s
    </div>
  );
}
