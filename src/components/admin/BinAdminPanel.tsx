import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  getBinDataQualityReport, exportBinDataQualityCsv,
  listBinImportRuns, importBinCsv,
} from "@/lib/bin-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Database, Download, Upload, RefreshCw } from "lucide-react";

export function BinAdminPanel() {
  const fetchReport = useServerFn(getBinDataQualityReport);
  const fetchRuns = useServerFn(listBinImportRuns);
  const exportCsv = useServerFn(exportBinDataQualityCsv);
  const importCsv = useServerFn(importBinCsv);

  const { data: report, refetch: refetchReport } = useQuery({
    queryKey: ["bin-data-quality"], queryFn: () => fetchReport(),
  });
  const { data: runs, refetch: refetchRuns } = useQuery({
    queryKey: ["bin-import-runs"], queryFn: () => fetchRuns(),
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState("manual-upload");
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    const { csv } = await exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bin-data-quality-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return toast.error("Choose a CSV first");
    setBusy(true);
    try {
      const csv = await file.text();
      const res = await importCsv({ data: { source, csv } });
      toast.success(`Import OK — added ${res.added}, updated ${res.updated}, skipped ${res.skipped}`);
      await Promise.all([refetchReport(), refetchRuns()]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <section className="surface p-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">BIN data quality</h3>
              <p className="text-xs text-muted-foreground">{report?.total_bins ?? 0} total BINs in catalog.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => refetchReport()}><RefreshCw className="h-3 w-3" /></Button>
            <Button size="sm" variant="outline" onClick={onExport}><Download className="mr-1 h-3 w-3" /> Export CSV</Button>
          </div>
        </header>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(report?.issues ?? []).map((i) => (
            <div key={i.kind} className="rounded-md border border-border/60 bg-secondary/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{i.label}</span>
                <Badge variant={i.count > 0 ? "destructive" : "secondary"}>{i.count}</Badge>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{i.action}</p>
              {i.last_detected && (
                <p className="mt-1 text-[10px] text-muted-foreground">Last seen {new Date(i.last_detected).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="surface p-5">
        <header className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Import BINs (CSV)</h3>
        </header>
        <p className="mt-1 text-xs text-muted-foreground">
          Columns: <code>bin_number</code>, <code>card_brand</code>, <code>card_type</code>, <code>card_bank</code>, <code>card_country</code>.
          Duplicates within the file are skipped; existing BINs are upserted.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input className="w-48" value={source} onChange={(e) => setSource(e.target.value)} placeholder="source label" />
          <Input ref={fileRef} type="file" accept=".csv,text/csv" className="w-64" />
          <Button onClick={onImport} disabled={busy}>{busy ? "Importing…" : "Upload"}</Button>
        </div>
      </section>

      <section className="surface overflow-hidden">
        <header className="flex items-center justify-between border-b border-border/40 px-5 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Import history</h3>
          <Button size="sm" variant="ghost" onClick={() => refetchRuns()}><RefreshCw className="h-3 w-3" /></Button>
        </header>
        <div className="divide-y divide-border/40">
          {(runs?.runs ?? []).map((r) => (
            <div key={r.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 px-5 py-2.5 text-xs">
              <span className="font-mono">{r.id.slice(0,8)}</span>
              <span>{r.source}</span>
              <Badge variant={r.status === "completed" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="w-fit">{r.status}</Badge>
              <span>+{r.rows_added} / ~{r.rows_updated} / -{r.rows_skipped}</span>
              <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
              <span className="text-muted-foreground truncate">{r.notes ?? ""}</span>
            </div>
          ))}
          {(runs?.runs ?? []).length === 0 && (
            <p className="px-5 py-6 text-center text-xs text-muted-foreground">No imports yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
