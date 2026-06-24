import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { myListings, updateMyThread, deleteMyThread } from "@/lib/marketplace.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Trash2, ExternalLink, Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/my-threads")({
  head: () => ({ meta: [{ title: "My Threads — EscrowDesk" }] }),
  component: () => (<AuthGate><MyThreads /></AuthGate>),
});

type Row = {
  id: string;
  user_id: string;
  kind: "selling" | "seeking";
  name: string;
  description: string;
  category: string;
  amount: number | null;
  currency: string | null;
  contact_telegram: string | null;
  contact_website: string | null;
  status: "active" | "inactive" | "sold";
  created_at: string;
  is_pinned?: boolean;
};

function MyThreads() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(myListings);
  const del = useServerFn(deleteMyThread);
  const { data, isLoading } = useQuery({
    queryKey: ["my-threads", user?.id],
    queryFn: () => list(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`my-threads-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["my-threads", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const rows = (data?.listings ?? []) as Row[];
  const counts = {
    active: rows.filter((r) => r.status === "active").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
    sold: rows.filter((r) => r.status === "sold").length,
  };

  async function handleDelete(id: string) {
    if (!confirm("Delete this thread permanently?")) return;
    try {
      await del({ data: { id } });
      toast.success("Thread deleted");
      qc.invalidateQueries({ queryKey: ["my-threads", user?.id] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Threads</h1>
          <p className="text-sm text-muted-foreground">Manage every thread you've posted on the order book.</p>
        </div>
        <Link to="/post-listing"><Button className="gap-2"><Plus className="h-4 w-4" /> Post a thread</Button></Link>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Stat label="Active" value={counts.active} tone="text-emerald-500" />
        <Stat label="Inactive" value={counts.inactive} tone="text-amber-500" />
        <Stat label="Sold" value={counts.sold} tone="text-primary" />
      </div>

      <div className="surface overflow-hidden">
        <header className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider">All my threads ({rows.length})</h2>
        </header>
        {isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && rows.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            You haven't posted any threads yet. <Link to="/post-listing" className="text-primary underline">Post your first one</Link>.
          </div>
        )}
        <div className="divide-y divide-border/40">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  <Badge variant={r.kind === "selling" ? "default" : "secondary"} className="text-[10px]">
                    {r.kind === "selling" ? "Selling" : "Seeking"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{r.category}</Badge>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                <div className="mt-1 text-[11px] text-muted-foreground font-mono">
                  {r.amount != null && `${r.currency || "USD"} ${r.amount}`} · posted {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <EditDialog row={r} onSaved={() => qc.invalidateQueries({ queryKey: ["my-threads", user?.id] })} />
                <Button size="sm" variant="ghost" className="gap-1" onClick={() => handleDelete(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="surface p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const tone = status === "active" ? "bg-emerald-500/15 text-emerald-500" :
               status === "sold" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${tone}`}>{status}</span>;
}

function EditDialog({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const update = useServerFn(updateMyThread);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: row.name,
    description: row.description,
    category: row.category,
    amount: row.amount?.toString() ?? "",
    currency: row.currency ?? "USD",
    contact_telegram: row.contact_telegram ?? "",
    contact_website: row.contact_website ?? "",
    status: row.status as "active" | "inactive" | "sold",
  });

  async function save() {
    setBusy(true);
    try {
      await update({
        data: {
          id: row.id,
          name: form.name,
          description: form.description,
          category: form.category,
          amount: form.amount ? Number(form.amount) : null,
          currency: form.currency,
          contact_telegram: form.contact_telegram || null,
          contact_website: form.contact_website || null,
          status: form.status,
        },
      });
      toast.success("Thread updated");
      setOpen(false);
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit thread</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Row["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive (paused)</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Currency</Label>
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </div>
            <div>
              <Label>Telegram</Label>
              <Input value={form.contact_telegram} onChange={(e) => setForm({ ...form, contact_telegram: e.target.value })} />
            </div>
            <div>
              <Label>Website</Label>
              <Input value={form.contact_website} onChange={(e) => setForm({ ...form, contact_website: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Link to="/product/$id" params={{ id: row.id }}>
            <Button variant="ghost" size="sm" className="gap-1"><ExternalLink className="h-3.5 w-3.5" /> View</Button>
          </Link>
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
