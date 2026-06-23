import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  listStaffQueue, assignMediator, setCaseStatus, signoffCase, ruleCase,
  getFraudSignals, listArbiters,
} from "@/lib/arbitration.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function ArbitrationPanel() {
  return (
    <Tabs defaultValue="queue">
      <TabsList>
        <TabsTrigger value="queue">Queue</TabsTrigger>
        <TabsTrigger value="ruling">Ruling</TabsTrigger>
        <TabsTrigger value="fraud">Fraud signals</TabsTrigger>
      </TabsList>
      <TabsContent value="queue" className="mt-4"><QueueTab /></TabsContent>
      <TabsContent value="ruling" className="mt-4"><RulingTab /></TabsContent>
      <TabsContent value="fraud" className="mt-4"><FraudTab /></TabsContent>
    </Tabs>
  );
}

function QueueTab() {
  const list = useServerFn(listStaffQueue);
  const assign = useServerFn(assignMediator);
  const setStatus = useServerFn(setCaseStatus);
  const arbs = useServerFn(listArbiters);
  const [filter, setFilter] = useState<string>("");
  const { data, refetch } = useQuery({
    queryKey: ["arb-queue", filter],
    queryFn: () => list({ data: filter ? { status: filter } : undefined }),
  });
  const { data: arbList } = useQuery({ queryKey: ["arbiters"], queryFn: () => arbs() });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="awaiting_evidence">Awaiting evidence</SelectItem>
            <SelectItem value="under_review">Under review</SelectItem>
            <SelectItem value="ruled">Ruled</SelectItem>
            <SelectItem value="appealed">Appealed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      </div>
      <div className="divide-y divide-border surface">
        {(data?.cases ?? []).map((c) => (
          <div key={c.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link to="/disputes/$id" params={{ id: c.id }} className="font-medium text-sm hover:underline">
                #{c.id.slice(0, 8)} · {c.category}
              </Link>
              <div className="text-xs text-muted-foreground truncate">{c.summary}</div>
              <div className="text-xs text-muted-foreground">
                ${Number(c.value_usd).toLocaleString()} · {new Date(c.opened_at).toLocaleDateString()}
              </div>
            </div>
            <Badge>{c.status}</Badge>
            <Select onValueChange={async (mid) => {
              try { await assign({ data: { case_id: c.id, mediator_id: mid } }); toast.success("Assigned"); refetch(); }
              catch (e) { toast.error((e as Error).message); }
            }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Assign…" /></SelectTrigger>
              <SelectContent>
                {(arbList?.arbiters ?? []).map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>{a.user_id.slice(0, 8)} ({a.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={async (s) => {
              try { await setStatus({ data: { case_id: c.id, status: s as "open"|"awaiting_evidence"|"under_review"|"ruled"|"appealed"|"closed" } }); toast.success("Status set"); refetch(); }
              catch (e) { toast.error((e as Error).message); }
            }}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">open</SelectItem>
                <SelectItem value="awaiting_evidence">awaiting_evidence</SelectItem>
                <SelectItem value="under_review">under_review</SelectItem>
                <SelectItem value="closed">closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
        {(data?.cases ?? []).length === 0 && (
          <div className="p-6 text-sm text-muted-foreground text-center">No cases.</div>
        )}
      </div>
    </div>
  );
}

function RulingTab() {
  const [caseId, setCaseId] = useState("");
  const [outcome, setOutcome] = useState<"release_to_seller"|"refund_to_buyer"|"partial_split"|"no_action">("release_to_seller");
  const [note, setNote] = useState("");
  const sign = useServerFn(signoffCase);
  const rule = useServerFn(ruleCase);

  return (
    <div className="surface p-5 space-y-3 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        High-value cases require multiple distinct arbiter sign-offs before the ruling can be executed.
      </p>
      <div>
        <label className="text-sm">Case ID</label>
        <Input value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="uuid" />
      </div>
      <div>
        <label className="text-sm">Outcome</label>
        <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="release_to_seller">Release to seller</SelectItem>
            <SelectItem value="refund_to_buyer">Refund to buyer</SelectItem>
            <SelectItem value="partial_split">Partial split</SelectItem>
            <SelectItem value="no_action">No action</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm">Ruling note</label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={async () => {
          if (!caseId) return;
          try { await sign({ data: { case_id: caseId } }); toast.success("Signed"); }
          catch (e) { toast.error((e as Error).message); }
        }}>Sign off</Button>
        <Button onClick={async () => {
          if (!caseId || note.length < 5) { toast.error("Need case ID and a 5+ char note"); return; }
          try { await rule({ data: { case_id: caseId, outcome, note } }); toast.success("Ruled"); }
          catch (e) { toast.error((e as Error).message); }
        }}>Issue ruling</Button>
      </div>
    </div>
  );
}

function FraudTab() {
  const fn = useServerFn(getFraudSignals);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["fraud-signals"], queryFn: () => fn() });

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
      {isLoading && <div className="text-sm text-muted-foreground">Scanning…</div>}
      {data && (
        <>
          <Section title={`Repeat openers (≥3 cases / 90d) · ${data.repeatOpeners.length}`}>
            {data.repeatOpeners.length === 0 ? <Empty /> : data.repeatOpeners.map((r) => (
              <div key={r.user_id} className="text-sm flex justify-between border-b border-border py-1">
                <span className="font-mono">{r.user_id.slice(0, 12)}</span>
                <span>{r.count} cases</span>
              </div>
            ))}
          </Section>
          <Section title={`Duplicate evidence hashes · ${data.duplicateHashes.length}`}>
            {data.duplicateHashes.length === 0 ? <Empty /> : data.duplicateHashes.map((d) => (
              <div key={d.sha256} className="text-sm py-1 border-b border-border">
                <div className="font-mono text-xs">{d.sha256.slice(0, 32)}…</div>
                <div className="text-xs text-muted-foreground">{d.case_count} cases</div>
              </div>
            ))}
          </Section>
          <Section title={`High-value open (≥$5k) · ${data.highValue.length}`}>
            {data.highValue.length === 0 ? <Empty /> : data.highValue.map((c) => (
              <Link key={c.id} to="/disputes/$id" params={{ id: c.id }}
                className="block text-sm py-1 border-b border-border hover:bg-muted/30 px-2 -mx-2">
                <span className="font-mono">#{c.id.slice(0, 8)}</span> · {c.category} · ${Number(c.value_usd).toLocaleString()}
              </Link>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-4">
      <h3 className="font-medium text-sm mb-2">{title}</h3>
      <div>{children}</div>
    </div>
  );
}
function Empty() { return <div className="text-xs text-muted-foreground">No signals.</div>; }
