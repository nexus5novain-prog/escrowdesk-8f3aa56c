import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getCase, postMessage, fileAppeal, recordEvidence, getEvidenceUrl, exportCaseReport,
} from "@/lib/arbitration.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronLeft, Download, Paperclip, Send } from "lucide-react";

export const Route = createFileRoute("/disputes/$id")({
  head: () => ({ meta: [{ title: "Case — EscrowDesk" }] }),
  component: () => (<AuthGate><CaseDetail /></AuthGate>),
});

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

function CaseDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getCase);
  const post = useServerFn(postMessage);
  const appeal = useServerFn(fileAppeal);
  const record = useServerFn(recordEvidence);
  const signedUrl = useServerFn(getEvidenceUrl);
  const exportFn = useServerFn(exportCaseReport);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["case", id],
    queryFn: () => get({ data: { id } }),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`case-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "arbitration_messages", filter: `case_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["case", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "arbitration_timeline", filter: `case_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["case", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "arbitration_cases", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["case", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const [msg, setMsg] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [uploading, setUploading] = useState(false);

  async function sendMessage() {
    if (!msg.trim()) return;
    try {
      await post({ data: { case_id: id, body: msg.trim() } });
      setMsg("");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function submitAppeal() {
    if (appealReason.trim().length < 10) { toast.error("Appeal reason too short"); return; }
    try {
      await appeal({ data: { case_id: id, reason: appealReason.trim() } });
      toast.success("Appeal filed");
      setAppealReason("");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleUpload(file: File) {
    if (file.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
    setUploading(true);
    try {
      const hash = await sha256Hex(file);
      const path = `${id}/${hash}-${file.name}`.slice(0, 480);
      const { error } = await supabase.storage.from("arbitration-evidence").upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (error && !error.message.includes("exists")) throw error;
      await record({ data: { case_id: id, file_path: path, sha256: hash, mime: file.type, size_bytes: file.size } });
      toast.success("Evidence uploaded");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(false); }
  }

  async function openEvidence(file_path: string) {
    try {
      const { url } = await signedUrl({ data: { file_path } });
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error((e as Error).message); }
  }

  async function downloadReport() {
    try {
      const report = await exportFn({ data: { case_id: id } });
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `case-${id.slice(0, 8)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error((e as Error).message); }
  }

  if (isLoading || !data) return <div className="py-20 text-center text-sm text-muted-foreground">Loading case…</div>;
  const c = data.case;
  const canAppeal = c.status === "ruled";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/disputes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Link>
        <Button variant="outline" size="sm" onClick={downloadReport}>
          <Download className="h-4 w-4 mr-1" /> Export JSON
        </Button>
      </div>

      <div className="surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">#{c.id.slice(0, 8)}</div>
            <h1 className="text-xl font-semibold">{c.category}</h1>
            <p className="text-sm text-muted-foreground mt-1">{c.summary}</p>
          </div>
          <Badge>{c.status}</Badge>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
          <div><span className="text-muted-foreground">Value:</span> ${Number(c.value_usd).toLocaleString()}</div>
          <div><span className="text-muted-foreground">Required signoffs:</span> {data.requiredSignoffs}</div>
          <div><span className="text-muted-foreground">Signed:</span> {data.signoffs.length}</div>
        </div>
        {c.outcome && (
          <div className="mt-3 p-3 rounded bg-muted/30 text-sm">
            <div className="font-medium">Outcome: {c.outcome}</div>
            {c.outcome_note && <div className="text-muted-foreground mt-1">{c.outcome_note}</div>}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface p-5 space-y-3">
          <h2 className="font-medium">Evidence vault</h2>
          <label className="flex items-center gap-2 text-sm border border-dashed border-border rounded p-3 cursor-pointer hover:bg-muted/30">
            <Paperclip className="h-4 w-4" />
            <span>{uploading ? "Uploading…" : "Drop / select a file (SHA-256 recorded)"}</span>
            <input type="file" className="hidden" disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          </label>
          <div className="space-y-1">
            {data.evidence.length === 0 && <div className="text-xs text-muted-foreground">No evidence yet.</div>}
            {data.evidence.map((e) => (
              <button key={e.id} onClick={() => openEvidence(e.file_path)}
                className="w-full text-left text-xs hover:bg-muted/30 rounded p-2 transition-colors">
                <div className="font-mono truncate">{e.file_path}</div>
                <div className="text-muted-foreground">sha256: {e.sha256.slice(0, 16)}… · {e.mime ?? "?"} · {(e.size_bytes ?? 0)}b</div>
              </button>
            ))}
          </div>
        </div>

        <div className="surface p-5 space-y-3">
          <h2 className="font-medium">Timeline</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.timeline.map((t) => (
              <div key={t.id} className="text-xs border-l-2 border-primary/30 pl-3">
                <div className="font-medium">{t.kind}</div>
                <div className="text-muted-foreground">{t.body ?? ""}</div>
                <div className="text-muted-foreground/70">{new Date(t.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface p-5 space-y-3">
        <h2 className="font-medium">Messages</h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-xs text-muted-foreground font-mono">{m.sender_id.slice(0, 8)}</span>
              {m.staff_only && <Badge className="ml-1 text-[10px]">staff</Badge>}
              <div>{m.body}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message…"
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} />
          <Button onClick={sendMessage}><Send className="h-4 w-4" /></Button>
        </div>
      </div>

      {canAppeal && (
        <div className="surface p-5 space-y-3">
          <h2 className="font-medium">File an appeal</h2>
          <Textarea rows={3} value={appealReason} onChange={(e) => setAppealReason(e.target.value)}
            placeholder="Explain why this ruling should be reviewed." />
          <Button variant="outline" onClick={submitAppeal}>Submit appeal</Button>
        </div>
      )}
    </div>
  );
}
