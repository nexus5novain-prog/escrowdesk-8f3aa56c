import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMyCases, openCase } from "@/lib/arbitration.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TradesSubNav } from "@/components/TradesSubNav";

export const Route = createFileRoute("/disputes")({
  head: () => ({ meta: [{ title: "Disputes — EscrowDesk" }] }),
  component: () => (<AuthGate><Disputes /></AuthGate>),
});

function statusTone(s: string): string {
  if (s === "ruled" || s === "closed") return "bg-emerald-500/15 text-emerald-500";
  if (s === "appealed") return "bg-amber-500/15 text-amber-500";
  if (s === "under_review") return "bg-blue-500/15 text-blue-500";
  return "bg-muted text-muted-foreground";
}

function Disputes() {
  const list = useServerFn(listMyCases);
  const open = useServerFn(openCase);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => list(),
    refetchInterval: 20_000,
  });

  const [form, setForm] = useState({ category: "", summary: "", value_usd: "0", trade_id: "" });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!form.category || form.summary.length < 10) {
      toast.error("Provide a category and a summary (≥ 10 chars).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await open({
        data: {
          category: form.category,
          summary: form.summary,
          value_usd: Number(form.value_usd) || 0,
          trade_id: form.trade_id || null,
        },
      });
      toast.success(`Case opened: ${res.id.slice(0, 8)}`);
      setForm({ category: "", summary: "", value_usd: "0", trade_id: "" });
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <TradesSubNav />
      <div>
        <h1 className="text-2xl font-semibold">Disputes & Arbitration</h1>
        <p className="text-sm text-muted-foreground">Open a case, track status, and file appeals.</p>
      </div>

      <div className="surface p-5 space-y-3">
        <h2 className="font-medium">Open a new case</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="non-delivery / quality / fraud / chargeback…" />
          </div>
          <div>
            <Label>Disputed value (USD)</Label>
            <Input type="number" value={form.value_usd}
              onChange={(e) => setForm({ ...form, value_usd: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Trade ID (optional)</Label>
            <Input value={form.trade_id} onChange={(e) => setForm({ ...form, trade_id: e.target.value })}
              placeholder="uuid of related trade" />
          </div>
          <div className="sm:col-span-2">
            <Label>Summary</Label>
            <Textarea rows={4} value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Describe what happened, dates, amounts, what you want." />
          </div>
        </div>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Open case"}
        </Button>
      </div>

      <div className="surface p-5">
        <h2 className="font-medium mb-3">My cases</h2>
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.cases.length ?? 0) === 0 && (
          <div className="text-sm text-muted-foreground">No cases yet.</div>
        )}
        <div className="divide-y divide-border">
          {data?.cases.map((c) => (
            <Link key={c.id} to="/disputes/$id" params={{ id: c.id }}
              className="flex items-center justify-between py-3 hover:bg-muted/30 rounded px-2 -mx-2 transition-colors">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{c.category} — ${Number(c.value_usd).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground truncate">{c.summary}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={statusTone(String(c.status))}>{c.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.opened_at).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
