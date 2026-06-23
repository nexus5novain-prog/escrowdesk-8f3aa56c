import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, DollarSign, Send, Copy, Wallet, Bitcoin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  getShoutboxConfig, postShoutWithWallet, postShoutWithBTC,
} from "@/lib/shoutbox.functions";

interface Props { displayName: string; onPosted?: () => void; }

/** Pay-to-post composer for the shoutbox.
 *  Sign-in required. Charges $5 either from in-app wallet (instant approval)
 *  or by sending BTC to the admin company address (manual approval). */
export function ShoutboxComposer({ displayName, onPosted }: Props) {
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"wallet" | "btc">("wallet");
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);

  const cfgFn = useServerFn(getShoutboxConfig);
  const { data: cfg } = useQuery({ queryKey: ["shoutbox-config"], queryFn: () => cfgFn(), staleTime: 60_000 });
  const payWallet = useServerFn(postShoutWithWallet);
  const payBtc = useServerFn(postShoutWithBTC);
  const fee = cfg?.fee_usd ?? 5;
  const btc = cfg?.btc_address ?? "";

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) { toast.error("Write something first"); return; }
    setBusy(true);
    try {
      if (mode === "wallet") {
        await payWallet({ data: { body: trimmed } });
        toast.success("Posted! Your shoutbox is live.");
      } else {
        if (!txid.trim()) { toast.error("Enter the BTC txid"); setBusy(false); return; }
        await payBtc({ data: { body: trimmed, txid: txid.trim() } });
        toast.success("Submitted! An admin will approve after confirming your BTC payment.");
      }
      setBody(""); setTxid(""); setOpen(false); onPosted?.();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="flex items-end gap-2">
        <Textarea
          value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={`Say something as ${displayName}…  (post fee: $${fee})`}
          maxLength={500} rows={2}
          className="min-h-0 resize-none text-sm"
        />
        <Button
          onClick={() => { if (!body.trim()) { toast.error("Write something first"); return; } setOpen(true); }}
          size="sm" className="gap-1.5"
          title={`Pay $${fee} to post`}
        >
          <span className="relative inline-flex items-center">
            <Lock className="h-3.5 w-3.5" />
            <DollarSign className="absolute -bottom-1 -right-1 h-2.5 w-2.5" />
          </span>
          Post ${fee}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish your shoutbox · ${fee}</DialogTitle>
            <DialogDescription>Pick how you want to pay. Wallet posts are instant. BTC posts go live after admin confirms the transaction.</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border/60 bg-background/40 p-3 text-xs">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preview</div>
            <p className="mt-1 line-clamp-3 text-foreground">{body}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("wallet")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${mode === "wallet" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
              <Wallet className="h-4 w-4" /> Wallet (BTC)
            </button>
            <button type="button" onClick={() => setMode("btc")}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${mode === "btc" ? "border-primary bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
              <Bitcoin className="h-4 w-4" /> On-chain BTC payment
            </button>
          </div>

          {mode === "wallet" ? (
            <p className="text-xs text-muted-foreground">${fee} worth of BTC will be debited from your wallet balance and your shoutbox will go live immediately. No escrow.</p>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Send exactly ${fee} worth of BTC to:</Label>
              {btc ? (
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                  <code className="flex-1 truncate font-mono text-xs">{btc}</code>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { navigator.clipboard.writeText(btc); toast.success("Address copied"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning">BTC address not configured yet. Ask an admin to set it.</p>
              )}
              <Label className="text-xs uppercase text-muted-foreground">Transaction ID (txid)</Label>
              <Input value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste your BTC txid" className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground">Your shoutbox will go viral once an admin confirms the transaction on-chain.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || (mode === "btc" && !btc)} className="gap-1.5">
              <Send className="h-3.5 w-3.5" /> {busy ? "Submitting…" : `Pay & post`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
