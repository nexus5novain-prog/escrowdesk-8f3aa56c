// Admin-only server functions for BIN data quality + import audit history.
// All callers verified via has_role('admin'/'moderator'/'support').
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: ReturnType<typeof requireSupabaseAuth> extends never ? never : any, userId: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isStaff = (data ?? []).some((r: { role: string }) => ["admin", "moderator", "support"].includes(r.role));
  if (!isStaff) throw new Error("Forbidden");
}

// ---------- Data quality report ----------
// Counts issues across bin_metadata:
//  - missing issuer bank
//  - missing card_brand (network)
//  - missing card_type
//  - missing card_country
//  - duplicate BIN prefixes
//  - conflicting metadata (same BIN, different brand/bank/country)
export const getBinDataQualityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // bin_metadata is unique on bin_number, so "duplicate" / "conflicting"
    // means same 6-digit IIN across both bin_metadata + bins (raw imports).
    const queries = await Promise.all([
      supabaseAdmin.from("bin_metadata").select("bin_number", { count: "exact", head: true }).is("card_bank", null),
      supabaseAdmin.from("bin_metadata").select("bin_number", { count: "exact", head: true }).is("card_brand", null),
      supabaseAdmin.from("bin_metadata").select("bin_number", { count: "exact", head: true }).is("card_type", null),
      supabaseAdmin.from("bin_metadata").select("bin_number", { count: "exact", head: true }).is("card_country", null),
      supabaseAdmin.from("bin_metadata").select("bin_number", { count: "exact", head: true }),
    ]);
    const [missingBank, missingNetwork, missingType, missingCountry, total] = queries.map((q) => q.count ?? 0);

    // Last detected date for each issue (latest updated_at among rows with the issue)
    const lastDates = await Promise.all([
      supabaseAdmin.from("bin_metadata").select("updated_at").is("card_bank", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("bin_metadata").select("updated_at").is("card_brand", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("bin_metadata").select("updated_at").is("card_type", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("bin_metadata").select("updated_at").is("card_country", null).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const issues = [
      {
        kind: "missing_issuer_bank",
        label: "Missing issuer information",
        count: missingBank,
        last_detected: lastDates[0].data?.updated_at ?? null,
        action: "Run an import from a current BIN source to fill the bank field.",
      },
      {
        kind: "unknown_card_network",
        label: "Unknown card network",
        count: missingNetwork,
        last_detected: lastDates[1].data?.updated_at ?? null,
        action: "Inspect rows; re-import or manually set the card_brand value.",
      },
      {
        kind: "unknown_card_type",
        label: "Unknown card type (debit/credit/prepaid)",
        count: missingType,
        last_detected: lastDates[2].data?.updated_at ?? null,
        action: "Re-import affected BINs from a richer source.",
      },
      {
        kind: "missing_country",
        label: "Missing country data",
        count: missingCountry,
        last_detected: lastDates[3].data?.updated_at ?? null,
        action: "Re-import affected BINs from a richer source.",
      },
    ];

    return { total_bins: total, issues };
  });

// CSV export of the data quality summary
export const exportBinDataQualityCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Export only rows that have at least one quality issue
    const { data, error } = await supabaseAdmin
      .from("bin_metadata")
      .select("bin_number, card_brand, card_type, card_bank, card_country, updated_at")
      .or("card_bank.is.null,card_brand.is.null,card_type.is.null,card_country.is.null")
      .limit(50_000);
    if (error) throw new Error(error.message);

    const header = ["bin_number", "card_brand", "card_type", "card_bank", "card_country", "updated_at"];
    const rows = (data ?? []).map((r) =>
      header.map((k) => `"${String((r as Record<string, unknown>)[k] ?? "").replace(/"/g, '""')}"`).join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    return { csv };
  });

// ---------- Import audit history ----------
export const listBinImportRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("bin_import_runs")
      .select("id, source, status, rows_added, rows_updated, rows_skipped, notes, run_by, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

// ---------- Import (CSV upload) ----------
// Accepts a CSV with the columns from the project's BIN source. Upserts on
// bin_number, tracks added/updated/skipped, records an audit row.
const csvImportSchema = z.object({
  source: z.string().trim().min(2).max(80),
  csv: z.string().min(20).max(10 * 1024 * 1024), // 10 MB cap
});

type BinRow = {
  bin_number: string;
  card_brand: string | null;
  card_type: string | null;
  card_bank: string | null;
  card_country: string | null;
};

function parseCsv(csv: string): BinRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const idx = {
    bin: header.findIndex((h) => h === "bin_number" || h === "bin" || h === "iin_start" || h === "iin"),
    brand: header.findIndex((h) => h === "card_brand" || h === "brand" || h === "scheme" || h === "network"),
    type: header.findIndex((h) => h === "card_type" || h === "type"),
    bank: header.findIndex((h) => h === "card_bank" || h === "bank" || h === "issuer"),
    country: header.findIndex((h) => h === "card_country" || h === "country"),
  };
  if (idx.bin < 0) throw new Error("CSV missing bin_number column");
  const rows: BinRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
    const bin = (cols[idx.bin] ?? "").replace(/\D/g, "").slice(0, 6);
    if (bin.length < 6) continue;
    rows.push({
      bin_number: bin,
      card_brand: idx.brand >= 0 ? (cols[idx.brand] || null) : null,
      card_type: idx.type >= 0 ? (cols[idx.type] || null) : null,
      card_bank: idx.bank >= 0 ? (cols[idx.bank] || null) : null,
      card_country: idx.country >= 0 ? (cols[idx.country] || null) : null,
    });
  }
  return rows;
}

export const importBinCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => csvImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: run, error: runErr } = await supabaseAdmin
      .from("bin_import_runs")
      .insert({ source: data.source, status: "running", run_by: context.userId })
      .select("id").single();
    if (runErr) throw new Error(runErr.message);

    let added = 0, updated = 0, skipped = 0;
    try {
      const rows = parseCsv(data.csv);
      // Dedup by bin_number (keep first)
      const seen = new Set<string>();
      const deduped: BinRow[] = [];
      for (const r of rows) {
        if (seen.has(r.bin_number)) { skipped += 1; continue; }
        seen.add(r.bin_number);
        deduped.push(r);
      }

      // Find existing rows in one shot to classify added vs updated
      const existing = new Set<string>();
      const chunk = 500;
      for (let i = 0; i < deduped.length; i += chunk) {
        const slice = deduped.slice(i, i + chunk).map((r) => r.bin_number);
        const { data: ex } = await supabaseAdmin
          .from("bin_metadata").select("bin_number").in("bin_number", slice);
        (ex ?? []).forEach((e) => existing.add(e.bin_number));
      }

      for (let i = 0; i < deduped.length; i += chunk) {
        const batch = deduped.slice(i, i + chunk);
        const { error: upErr } = await supabaseAdmin
          .from("bin_metadata").upsert(batch as never, { onConflict: "bin_number" });
        if (upErr) throw new Error(upErr.message);
        for (const r of batch) {
          if (existing.has(r.bin_number)) updated += 1; else added += 1;
        }
      }

      await supabaseAdmin.from("bin_import_runs").update({
        status: "completed", rows_added: added, rows_updated: updated, rows_skipped: skipped,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);

      return { run_id: run.id, added, updated, skipped };
    } catch (err) {
      await supabaseAdmin.from("bin_import_runs").update({
        status: "failed", rows_added: added, rows_updated: updated, rows_skipped: skipped,
        notes: (err as Error).message, finished_at: new Date().toISOString(),
      }).eq("id", run.id);
      throw err;
    }
  });
