import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dealTypes = z.enum([
  "marketplace","product","service","vehicle","property",
  "freelance","invoice","business","import_export","construction",
  "milestone","digital_product","domain","website","software",
  "crypto","equipment","trade","investment","custom",
]);

const createSchema = z.object({
  deal_type: dealTypes,
  title: z.string().min(3).max(160),
  description: z.string().max(4000).optional().default(""),
  terms: z.string().max(8000).optional().default(""),
  amount: z.number().positive(),
  currency: z.string().min(3).max(6).default("BTC"),
  counterparty_role: z.enum(["buyer", "seller"]),
  counterparty_email: z.string().email().optional().nullable(),
  location_country: z.string().max(4).optional().nullable(),
  location_state: z.string().max(120).optional().nullable(),
  location_city: z.string().max(120).optional().nullable(),
  expected_delivery_at: z.string().datetime().optional().nullable(),
});

export const createEscrowDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Creator becomes the opposite side of the counterparty role
    const buyer_id = data.counterparty_role === "seller" ? userId : null;
    const seller_id = data.counterparty_role === "buyer" ? userId : null;
    const buyer_email = data.counterparty_role === "buyer" ? data.counterparty_email ?? null : null;
    const seller_email = data.counterparty_role === "seller" ? data.counterparty_email ?? null : null;

    const { data: deal, error } = await supabase
      .from("escrow_deals")
      .insert({
        creator_id: userId,
        deal_type: data.deal_type,
        title: data.title,
        description: data.description || null,
        terms: data.terms || null,
        currency: data.currency,
        amount: data.amount,
        status: "draft",
        buyer_id,
        seller_id,
        buyer_email,
        seller_email,
        location_country: data.location_country || null,
        location_state: data.location_state || null,
        location_city: data.location_city || null,
        expected_delivery_at: data.expected_delivery_at || null,
      })
      .select("id, reference")
      .single();
    if (error) throw new Error(error.message);
    return deal;
  });

export const listMyEscrowDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("escrow_deals")
      .select("id, reference, title, deal_type, status, amount, currency, created_at, creator_id, buyer_id, seller_id")
      .or(`creator_id.eq.${userId},buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getEscrowDeal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: deal, error } = await context.supabase
      .from("escrow_deals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) throw new Error("Deal not found");

    const { data: invites } = await context.supabase
      .from("escrow_invitations")
      .select("id, role, token, invited_email, accepted_at, expires_at, created_at")
      .eq("deal_id", data.id)
      .order("created_at", { ascending: false });

    return { deal, invites: invites ?? [] };
  });

export const createEscrowInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      deal_id: z.string().uuid(),
      role: z.enum(["buyer", "seller", "observer"]),
      invited_email: z.string().email().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: invite, error } = await supabase
      .from("escrow_invitations")
      .insert({
        deal_id: data.deal_id,
        invited_by: userId,
        role: data.role,
        invited_email: data.invited_email ?? null,
      })
      .select("id, token, role, expires_at")
      .single();
    if (error) throw new Error(error.message);

    // Move deal to "invited" if still draft
    await supabase
      .from("escrow_deals")
      .update({ status: "invited" })
      .eq("id", data.deal_id)
      .eq("status", "draft");

    return invite;
  });

export const previewEscrowInvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: invite, error } = await context.supabase
      .from("escrow_invitations")
      .select("id, deal_id, role, invited_email, accepted_at, expires_at, invited_by")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) throw new Error("Invite not found or already used");

    const { data: deal } = await context.supabase
      .from("escrow_deals")
      .select("id, reference, title, deal_type, amount, currency, description, status")
      .eq("id", invite.deal_id)
      .maybeSingle();

    return { invite, deal };
  });

export const acceptEscrowInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: invite, error: iErr } = await supabase
      .from("escrow_invitations")
      .select("id, deal_id, role, accepted_by, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_by) throw new Error("Invite already accepted");
    if (new Date(invite.expires_at).getTime() < Date.now()) throw new Error("Invite expired");

    const { error: uErr } = await supabase
      .from("escrow_invitations")
      .update({ accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (uErr) throw new Error(uErr.message);

    // Attach the accepter to the deal in the chosen role
    const patch: { status: "accepted"; buyer_id?: string; seller_id?: string } = { status: "accepted" };
    if (invite.role === "buyer") patch.buyer_id = userId;
    if (invite.role === "seller") patch.seller_id = userId;
    await supabase.from("escrow_deals").update(patch).eq("id", invite.deal_id);

    return { deal_id: invite.deal_id };
  });

// Location lookup (uses public read policies — no auth needed, but we route it
// through an authed fn to keep client bundles small).
export const listRegions = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data } = await c.from("regions").select("code,name").order("sort_order");
    return data ?? [];
  });

export const listCountries = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ region_code: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const c = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    let q = c.from("countries").select("code,name,region_code").order("name");
    if (data.region_code) q = q.eq("region_code", data.region_code);
    const { data: rows } = await q;
    return rows ?? [];
  });
