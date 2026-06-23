import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdPlacement =
  | "top" | "center" | "bottom" | "footer"
  | "marketplace_grid" | "order_book_sidebar" | "trades_escrow"
  | "sidebar_resources" | "under_hero" | "sidebar_top" | "sidebar_mid"
  | "sidebar_bottom" | "between_threads" | "between_sections"
  | "footer_banner" | "floating_corner" | "inline_card";
export type AdMediaType = "image" | "video" | "html" | "link";

const PlacementSchema = z.enum([
  "top", "center", "bottom", "footer",
  "marketplace_grid", "order_book_sidebar", "trades_escrow",
  "sidebar_resources", "under_hero", "sidebar_top", "sidebar_mid",
  "sidebar_bottom", "between_threads", "between_sections",
  "footer_banner", "floating_corner", "inline_card",
]);

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

export const listAdsForPlacement = createServerFn({ method: "GET" })
  .inputValidator(z.object({ placement: PlacementSchema }))
  .handler(async ({ data }) => {
    const now = new Date().toISOString();
    const { data: rows } = await supabaseAdmin
      .from("ad_banners")
      .select("id,title,media_type,media_url,html_content,link_url,cta_label,placements,priority,starts_at,ends_at")
      .eq("is_active", true)
      .contains("placements", [data.placement])
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("priority", { ascending: false })
      .limit(20);
    return { ads: rows ?? [], fetched_at: now };
  });

// Tracking — public (anonymous impressions/clicks/errors allowed); ad_id must exist & be active
export const trackAdEvent = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    ad_id: z.string().uuid(),
    kind: z.enum(["impression", "click", "error"]),
    placement: PlacementSchema,
  }))
  .handler(async ({ data }) => {
    const { data: ad } = await supabaseAdmin
      .from("ad_banners").select("id,is_active").eq("id", data.ad_id).maybeSingle();
    if (!ad || !ad.is_active) return { ok: false };
    await supabaseAdmin.from("ad_events").insert({
      ad_id: data.ad_id, kind: data.kind, placement: data.placement, viewer_id: null,
    });
    return { ok: true };
  });


export const adminListAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("ad_banners").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { ads: data ?? [] };
  });

export const adminAdAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ days: z.number().int().min(1).max(365).default(30) }).optional().transform((v) => v ?? { days: 30 }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin.rpc("ad_analytics", { _since: since });
    if (error) throw new Error(error.message);
    // Placement breakdown
    const { data: placements } = await supabaseAdmin
      .from("ad_events").select("placement,kind").gte("created_at", since).limit(50000);
    const byPlacement = new Map<string, { impressions: number; clicks: number }>();
    for (const r of placements ?? []) {
      const cur = byPlacement.get(r.placement) ?? { impressions: 0, clicks: 0 };
      if (r.kind === "click") cur.clicks++; else cur.impressions++;
      byPlacement.set(r.placement, cur);
    }
    const placementsArr = Array.from(byPlacement.entries()).map(([placement, v]) => ({
      placement, ...v,
      ctr: v.impressions ? Math.round((v.clicks / v.impressions) * 10000) / 100 : 0,
    })).sort((a, b) => b.impressions - a.impressions);
    return { ads: rows ?? [], placements: placementsArr };
  });

export const adminCreateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    title: z.string().trim().min(2).max(120),
    media_type: z.enum(["image", "video", "html", "link"]),
    media_url: z.string().trim().max(1000).optional().nullable(),
    html_content: z.string().trim().max(8000).optional().nullable(),
    link_url: z.string().trim().max(1000).optional().nullable(),
    cta_label: z.string().trim().max(60).optional().nullable(),
    placements: z.array(PlacementSchema).min(1),
    priority: z.number().int().min(0).max(100).default(0),
    is_active: z.boolean().default(true),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if ((data.media_type === "image" || data.media_type === "video") && !data.media_url) {
      throw new Error("Media URL required for image/video ads");
    }
    if (data.media_type === "html" && !data.html_content) {
      throw new Error("HTML content required for HTML ads");
    }
    if (data.media_type === "link" && !data.link_url) {
      throw new Error("Click-through URL required for link/CTA ads");
    }
    const { data: row, error } = await supabaseAdmin.from("ad_banners").insert({
      title: data.title,
      media_type: data.media_type,
      media_url: data.media_url || null,
      html_content: data.html_content || null,
      link_url: data.link_url || null,
      cta_label: data.cta_label || null,
      placements: data.placements,
      priority: data.priority,
      is_active: data.is_active,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      created_by: context.userId,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminUpdateAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    is_active: z.boolean().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    title: z.string().trim().min(2).max(120).optional(),
    media_url: z.string().trim().max(1000).nullable().optional(),
    html_content: z.string().trim().max(8000).nullable().optional(),
    link_url: z.string().trim().max(1000).nullable().optional(),
    cta_label: z.string().trim().max(60).nullable().optional(),
    placements: z.array(PlacementSchema).min(1).optional(),
    starts_at: z.string().datetime().nullable().optional(),
    ends_at: z.string().datetime().nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("ad_banners").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("ad_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
