import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Value tiers gating multi-signature rulings.
// Each tier requires N distinct arbiters to sign off before ruleCase succeeds.
export const SIGNOFF_TIERS = [
  { maxUsd: 500, signoffs: 1 },
  { maxUsd: 5_000, signoffs: 2 },
  { maxUsd: Infinity, signoffs: 3 },
] as const;

export function requiredSignoffs(valueUsd: number): number {
  for (const t of SIGNOFF_TIERS) if (valueUsd < t.maxUsd) return t.signoffs;
  return 3;
}

const ARBITER_ROLES = ["admin", "super_admin", "senior_arbitrator", "mediator", "judge"] as const;

async function assertArbiter(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ARBITER_ROLES as unknown as ("admin"|"super_admin"|"senior_arbitrator"|"mediator"|"judge")[]);
  if (!data || data.length === 0) throw new Error("Forbidden: arbiter role required");
  return (data[0].role as string);
}

// ============ Open case ============
export const openCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      trade_id: z.string().uuid().nullable().optional(),
      escrow_group_id: z.string().uuid().nullable().optional(),
      respondent_id: z.string().uuid().nullable().optional(),
      category: z.string().trim().min(2).max(60),
      summary: z.string().trim().min(10).max(4000),
      value_usd: z.number().nonnegative().max(10_000_000).default(0),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("arbitration_cases")
      .insert({
        trade_id: data.trade_id ?? null,
        escrow_group_id: data.escrow_group_id ?? null,
        opener_id: userId,
        respondent_id: data.respondent_id ?? null,
        category: data.category,
        summary: data.summary,
        value_usd: data.value_usd,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ============ List my cases ============
export const listMyCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("arbitration_cases")
      .select("id,trade_id,escrow_group_id,opener_id,respondent_id,category,summary,status,value_usd,mediator_id,outcome,opened_at,ruled_at")
      .or(`opener_id.eq.${userId},respondent_id.eq.${userId}`)
      .order("opened_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { cases: data ?? [] };
  });

// ============ Staff queue ============
export const listStaffQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ status: z.string().max(40).optional() }).optional().transform((v) => v ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    let q = supabase
      .from("arbitration_cases")
      .select("id,trade_id,opener_id,respondent_id,category,summary,status,value_usd,mediator_id,outcome,opened_at,ruled_at")
      .order("opened_at", { ascending: false })
      .limit(500);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { cases: rows ?? [] };
  });

// ============ Get case (role-aware redaction) ============
export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error } = await supabase
      .from("arbitration_cases")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Case not found");

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ARBITER_ROLES as unknown as ("admin"|"super_admin"|"senior_arbitrator"|"mediator"|"judge")[]);
    const isArbiter = (roleRows?.length ?? 0) > 0;

    const [evidence, timeline, messages, signoffs, notes] = await Promise.all([
      supabase.from("arbitration_evidence")
        .select("id,uploader_id,file_path,sha256,mime,size_bytes,note,created_at")
        .eq("case_id", data.id).order("created_at"),
      supabase.from("arbitration_timeline")
        .select("id,actor_id,kind,body,created_at")
        .eq("case_id", data.id).order("created_at"),
      supabase.from("arbitration_messages")
        .select("id,sender_id,body,staff_only,created_at")
        .eq("case_id", data.id).order("created_at"),
      supabase.from("arbitration_signoffs")
        .select("id,signer_id,signer_role,created_at")
        .eq("case_id", data.id),
      isArbiter
        ? supabase.from("arbitration_notes")
            .select("id,author_id,body,created_at")
            .eq("case_id", data.id).order("created_at")
        : Promise.resolve({ data: [] }),
    ]);

    const filteredMessages = isArbiter
      ? (messages.data ?? [])
      : (messages.data ?? []).filter((m: { staff_only: boolean }) => !m.staff_only);

    return {
      case: c,
      evidence: evidence.data ?? [],
      timeline: timeline.data ?? [],
      messages: filteredMessages,
      signoffs: signoffs.data ?? [],
      notes: notes.data ?? [],
      isArbiter,
      requiredSignoffs: requiredSignoffs(Number(c.value_usd)),
    };
  });

// ============ Upload evidence (record metadata after client upload) ============
export const recordEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      case_id: z.string().uuid(),
      file_path: z.string().min(3).max(500),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i),
      mime: z.string().max(120).optional(),
      size_bytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
      note: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("arbitration_evidence")
      .insert({
        case_id: data.case_id,
        uploader_id: userId,
        file_path: data.file_path,
        sha256: data.sha256.toLowerCase(),
        mime: data.mime,
        size_bytes: data.size_bytes,
        note: data.note,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("arbitration_timeline").insert({
      case_id: data.case_id, actor_id: userId, kind: "evidence_uploaded", body: data.file_path,
    });
    return { id: row.id };
  });

// ============ Send message ============
export const postMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      case_id: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      staff_only: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.staff_only) await assertArbiter(supabase, userId);
    const { data: row, error } = await supabase
      .from("arbitration_messages")
      .insert({ case_id: data.case_id, sender_id: userId, body: data.body, staff_only: !!data.staff_only })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ============ Add internal note (staff only) ============
export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ case_id: z.string().uuid(), body: z.string().trim().min(1).max(4000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { error } = await supabase
      .from("arbitration_notes")
      .insert({ case_id: data.case_id, author_id: userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Assign mediator ============
export const assignMediator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ case_id: z.string().uuid(), mediator_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { error } = await supabase
      .from("arbitration_cases")
      .update({ mediator_id: data.mediator_id, status: "under_review" })
      .eq("id", data.case_id);
    if (error) throw new Error(error.message);
    await supabase.from("arbitration_timeline").insert({
      case_id: data.case_id, actor_id: userId, kind: "mediator_assigned", body: data.mediator_id,
    });
    await supabase.from("arbitration_audit_log").insert({
      case_id: data.case_id, actor_id: userId, action: "mediator_assigned",
      payload: { mediator_id: data.mediator_id },
    });
    return { ok: true };
  });

// ============ Set status ============
export const setCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      case_id: z.string().uuid(),
      status: z.enum(["open", "awaiting_evidence", "under_review", "ruled", "appealed", "closed"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { error } = await supabase
      .from("arbitration_cases").update({ status: data.status }).eq("id", data.case_id);
    if (error) throw new Error(error.message);
    await supabase.from("arbitration_timeline").insert({
      case_id: data.case_id, actor_id: userId, kind: "status_changed", body: data.status,
    });
    return { ok: true };
  });

// ============ Sign off (multi-sig for high-value rulings) ============
export const signoffCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ case_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const role = await assertArbiter(supabase, userId);
    const { error } = await supabase
      .from("arbitration_signoffs")
      .insert({ case_id: data.case_id, signer_id: userId, signer_role: role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    await supabase.from("arbitration_audit_log").insert({
      case_id: data.case_id, actor_id: userId, action: "signoff", payload: { role },
    });
    return { ok: true };
  });

// ============ Rule case ============
export const ruleCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      case_id: z.string().uuid(),
      outcome: z.enum(["release_to_seller", "refund_to_buyer", "partial_split", "no_action"]),
      note: z.string().trim().min(5).max(4000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { data: c, error: cerr } = await supabase
      .from("arbitration_cases").select("value_usd, trade_id, status").eq("id", data.case_id).maybeSingle();
    if (cerr) throw new Error(cerr.message);
    if (!c) throw new Error("Case not found");
    if (c.status === "ruled" || c.status === "closed") throw new Error("Case already ruled");

    const needed = requiredSignoffs(Number(c.value_usd));
    const { data: signs } = await supabase
      .from("arbitration_signoffs").select("signer_id").eq("case_id", data.case_id);
    const distinct = new Set([...(signs ?? []).map((s: { signer_id: string }) => s.signer_id), userId]);
    if (distinct.size < needed) {
      throw new Error(`Ruling requires ${needed} distinct arbiter sign-offs (have ${distinct.size}).`);
    }

    const { error: uerr } = await supabase
      .from("arbitration_cases")
      .update({ status: "ruled", outcome: data.outcome, outcome_note: data.note, ruled_at: new Date().toISOString() })
      .eq("id", data.case_id);
    if (uerr) throw new Error(uerr.message);

    await supabase.from("arbitration_timeline").insert({
      case_id: data.case_id, actor_id: userId, kind: "ruled", body: `${data.outcome}: ${data.note}`,
    });
    await supabase.from("arbitration_audit_log").insert({
      case_id: data.case_id, actor_id: userId, action: "ruled",
      payload: { outcome: data.outcome, signoffs: Array.from(distinct) },
    });
    return { ok: true };
  });

// ============ File appeal ============
export const fileAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ case_id: z.string().uuid(), reason: z.string().trim().min(10).max(4000) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("arbitration_appeals")
      .insert({ case_id: data.case_id, appellant_id: userId, reason: data.reason });
    if (error) throw new Error(error.message);
    await supabase.from("arbitration_cases").update({ status: "appealed" }).eq("id", data.case_id);
    await supabase.from("arbitration_timeline").insert({
      case_id: data.case_id, actor_id: userId, kind: "appeal_filed", body: data.reason,
    });
    return { ok: true };
  });

// ============ Decide appeal ============
export const decideAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      appeal_id: z.string().uuid(),
      status: z.enum(["granted", "denied"]),
      decision_note: z.string().trim().min(5).max(4000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { error } = await supabase
      .from("arbitration_appeals")
      .update({
        status: data.status,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.decision_note,
      })
      .eq("id", data.appeal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Signed URL for evidence file ============
export const getEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ file_path: z.string().min(3).max(500) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase
      .storage.from("arbitration-evidence").createSignedUrl(data.file_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ============ Fraud signals (staff only) ============
export const getFraudSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

    // Repeat openers in last 90d
    const { data: recent } = await supabase
      .from("arbitration_cases")
      .select("id,opener_id,respondent_id,category,status,value_usd,opened_at")
      .gte("opened_at", since)
      .order("opened_at", { ascending: false })
      .limit(1000);

    const counts = new Map<string, number>();
    for (const r of recent ?? []) counts.set(r.opener_id, (counts.get(r.opener_id) ?? 0) + 1);
    const repeatOpeners = Array.from(counts.entries())
      .filter(([, n]) => n >= 3)
      .map(([user_id, count]) => ({ user_id, count }))
      .sort((a, b) => b.count - a.count);

    // Duplicate evidence hashes across cases
    const { data: ev } = await supabase
      .from("arbitration_evidence")
      .select("sha256,case_id,uploader_id")
      .limit(5000);
    const hashMap = new Map<string, Set<string>>();
    for (const e of ev ?? []) {
      const s = hashMap.get(e.sha256) ?? new Set();
      s.add(e.case_id);
      hashMap.set(e.sha256, s);
    }
    const duplicateHashes = Array.from(hashMap.entries())
      .filter(([, set]) => set.size > 1)
      .map(([sha256, set]) => ({ sha256, case_count: set.size, case_ids: Array.from(set) }));

    // High-value open cases
    const highValue = (recent ?? [])
      .filter((r) => Number(r.value_usd) >= 5000 && !["ruled", "closed"].includes(String(r.status)))
      .slice(0, 50);

    return {
      repeatOpeners,
      duplicateHashes,
      highValue,
      generatedAt: new Date().toISOString(),
    };
  });

// ============ Export case report (JSON) ============
export const exportCaseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ case_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error } = await supabase
      .from("arbitration_cases").select("*").eq("id", data.case_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) throw new Error("Case not found");

    // Allow staff or case party
    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    const isArbiter = (roleRows ?? []).some((r: { role: string }) =>
      (ARBITER_ROLES as readonly string[]).includes(r.role));
    if (!isArbiter && c.opener_id !== userId && c.respondent_id !== userId) {
      throw new Error("Forbidden");
    }

    const [evidence, timeline, messages, signoffs, audit, appeals] = await Promise.all([
      supabase.from("arbitration_evidence").select("*").eq("case_id", data.case_id).order("created_at"),
      supabase.from("arbitration_timeline").select("*").eq("case_id", data.case_id).order("created_at"),
      supabase.from("arbitration_messages").select("*").eq("case_id", data.case_id).order("created_at"),
      supabase.from("arbitration_signoffs").select("*").eq("case_id", data.case_id),
      isArbiter
        ? supabase.from("arbitration_audit_log").select("*").eq("case_id", data.case_id).order("created_at")
        : Promise.resolve({ data: [] }),
      supabase.from("arbitration_appeals").select("*").eq("case_id", data.case_id),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      case: c,
      evidence: evidence.data ?? [],
      timeline: timeline.data ?? [],
      messages: (messages.data ?? []).filter((m: { staff_only: boolean }) => isArbiter || !m.staff_only),
      signoffs: signoffs.data ?? [],
      audit: audit.data ?? [],
      appeals: appeals.data ?? [],
    };
  });

// ============ List arbiters (for mediator assignment) ============
export const listArbiters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertArbiter(supabase, userId);
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id,role")
      .in("role", ARBITER_ROLES as unknown as ("admin"|"super_admin"|"senior_arbitrator"|"mediator"|"judge")[]);
    if (error) throw new Error(error.message);
    return { arbiters: data ?? [] };
  });

