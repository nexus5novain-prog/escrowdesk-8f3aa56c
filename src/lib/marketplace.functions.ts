import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ListingRow = {
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
  profile: {
    display_name: string;
    avatar_url: string | null;
    telegram_username: string | null;
    is_premium: boolean;
    is_trusted: boolean;
    trades_completed: number;
    rating_sum: number;
    rating_count: number;
  } | null;
};

export type Tier = "premium" | "trusted" | "regular";

// Rank score used to order threads from highest to lowest within each tier.
// Composition: tier-boost + avg rating + completed-trade depth + freshness bonus.
export function computeThreadRank(p: ListingRow["profile"], createdAt: string): number {
  const tierBoost = p?.is_premium ? 10_000 : p?.is_trusted ? 5_000 : 0;
  const avgRating = p && p.rating_count > 0 ? p.rating_sum / p.rating_count : 0;
  const ratingScore = avgRating * 200; // 0..1000
  const tradesScore = Math.min(p?.trades_completed ?? 0, 500); // capped depth
  const ageHrs = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  const freshness = Math.max(0, 200 - ageHrs); // decays over ~8 days
  return tierBoost + ratingScore + tradesScore + freshness;
}

export type TopAuthor = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  telegram_username: string | null;
  is_premium: boolean;
  is_trusted: boolean;
  trades_completed: number;
  rating_sum: number;
  rating_count: number;
  btc_volume_usd: number;
  active_threads: number;
  selling_count: number;
  seeking_count: number;
  latest_at: string;
  rank: number;
};

export const listTopAuthors = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: rows, error } = await supabaseAdmin
      .from("listings")
      .select("user_id,kind,created_at")
      .eq("status", "active")
      .limit(2000);
    if (error) throw new Error(error.message);
    const byUser = new Map<string, { selling: number; seeking: number; latest: string }>();
    for (const r of rows ?? []) {
      const cur = byUser.get(r.user_id) ?? { selling: 0, seeking: 0, latest: r.created_at };
      if (r.kind === "selling") cur.selling++; else cur.seeking++;
      if (r.created_at > cur.latest) cur.latest = r.created_at;
      byUser.set(r.user_id, cur);
    }
    const ids = Array.from(byUser.keys());
    if (!ids.length) return { authors: [] as TopAuthor[] };
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("user_id,display_name,avatar_url,telegram_username,is_premium,is_trusted,is_banned,suspended_until,trades_completed,rating_sum,rating_count,btc_volume_usd")
      .in("user_id", ids);
    const now = Date.now();
    const visible = (profs ?? []).filter((p) => !p.is_banned && !(p.suspended_until && new Date(p.suspended_until).getTime() > now));
    const pm = new Map(visible.map((p) => [p.user_id, p]));
    const authors: TopAuthor[] = ids.filter((uid) => pm.has(uid)).map((uid) => {
      const counts = byUser.get(uid)!;
      const p = pm.get(uid)!;
      const profile = {
        display_name: p.display_name ?? "Anon",
        avatar_url: p.avatar_url,
        telegram_username: p.telegram_username,
        is_premium: !!p.is_premium,
        is_trusted: !!p.is_trusted,
        trades_completed: p.trades_completed ?? 0,
        rating_sum: p.rating_sum ?? 0,
        rating_count: p.rating_count ?? 0,
      };
      return {
        user_id: uid,
        display_name: p.display_name ?? "Anon",
        avatar_url: p.avatar_url ?? null,
        telegram_username: p.telegram_username ?? null,
        is_premium: !!p.is_premium,
        is_trusted: !!p.is_trusted,
        trades_completed: p.trades_completed ?? 0,
        rating_sum: p.rating_sum ?? 0,
        rating_count: p.rating_count ?? 0,
        btc_volume_usd: Number(p.btc_volume_usd ?? 0),
        active_threads: counts.selling + counts.seeking,
        selling_count: counts.selling,
        seeking_count: counts.seeking,
        latest_at: counts.latest,
        rank: computeThreadRank(profile, counts.latest) + counts.selling + counts.seeking,
      };
    });
    authors.sort((a, b) => b.rank - a.rank);
    return { authors: authors.slice(0, 100) };
  });

export type CategoryThread = {
  id: string;
  user_id: string;
  kind: "selling" | "seeking";
  name: string;
  category: string;
  amount: number | null;
  currency: string | null;
  status: "active" | "inactive" | "sold";
  created_at: string;
  is_pinned: boolean;
  author: string;
  avatar_url: string | null;
  telegram_username: string | null;
  is_premium: boolean;
  is_trusted: boolean;
  trades_completed: number;
  rating_avg: number | null;
  rating_count: number;
};

export const listCategoryThreads = createServerFn({ method: "GET" })
  .inputValidator(z.object({ section: z.string().min(1).max(60) }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("listings")
      .select("id,user_id,kind,name,category,amount,currency,status,created_at,is_pinned")
      .eq("status", "active")
      .ilike("category", `${data.section}%`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles")
          .select("user_id,display_name,avatar_url,telegram_username,is_premium,is_trusted,is_banned,suspended_until,trades_completed,rating_sum,rating_count")
          .in("user_id", ids)
      : { data: [] as Array<{ user_id: string; display_name: string; avatar_url: string | null; telegram_username: string | null; is_premium: boolean; is_trusted: boolean; is_banned: boolean; suspended_until: string | null; trades_completed: number; rating_sum: number; rating_count: number }> };
    const now = Date.now();
    const visible = (profs ?? []).filter((p) => !p.is_banned && !(p.suspended_until && new Date(p.suspended_until).getTime() > now));
    const pm = new Map(visible.map((p) => [p.user_id, p]));
    const threads: CategoryThread[] = (rows ?? []).filter((r) => pm.has(r.user_id)).map((r) => {
      const p = pm.get(r.user_id)!;
      const ratingCount = p.rating_count ?? 0;
      return {
        id: r.id,
        user_id: r.user_id,
        kind: r.kind as "selling" | "seeking",
        name: r.name,
        category: r.category,
        amount: r.amount as number | null,
        currency: r.currency as string | null,
        status: r.status as "active" | "inactive" | "sold",
        created_at: r.created_at,
        is_pinned: !!(r as { is_pinned?: boolean }).is_pinned,
        author: p.display_name ?? "Anon",
        avatar_url: p.avatar_url ?? null,
        telegram_username: p.telegram_username ?? null,
        is_premium: !!p.is_premium,
        is_trusted: !!p.is_trusted,
        trades_completed: p.trades_completed ?? 0,
        rating_avg: ratingCount > 0 ? (p.rating_sum ?? 0) / ratingCount : null,
        rating_count: ratingCount,
      };
    });
    // Pinned first, then tier (premium > trusted > regular), then recency.
    threads.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const tier = (t: CategoryThread) => (t.is_premium ? 2 : t.is_trusted ? 1 : 0);
      const d = tier(b) - tier(a);
      return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
    });
    return { threads };
  });


export const listMarketplace = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ q: z.string().max(120).optional(), category: z.string().max(60).optional() })
      .optional()
      .transform((v) => v ?? {}),
  )
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("listings")
      .select("id,user_id,kind,name,description,category,amount,currency,contact_telegram,contact_website,status,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const profs = ids.length
      ? (
          await supabaseAdmin
            .from("profiles")
            .select("user_id,display_name,avatar_url,telegram_username,is_premium,is_trusted,is_banned,suspended_until,trades_completed,rating_sum,rating_count")
            .in("user_id", ids)
        ).data ?? []
      : [];
    const now = Date.now();
    const visible = profs.filter((p) => !p.is_banned && !(p.suspended_until && new Date(p.suspended_until).getTime() > now));
    const pm = new Map(visible.map((p) => [p.user_id, p]));
    const enriched: ListingRow[] = (rows ?? []).filter((r) => pm.has(r.user_id)).map((r) => ({
      ...(r as Omit<ListingRow, "profile">),
      profile: (pm.get(r.user_id) as ListingRow["profile"]) ?? null,
    }));
    const tierOf = (l: ListingRow): Tier =>
      l.profile?.is_premium ? "premium" : l.profile?.is_trusted ? "trusted" : "regular";
    const groups: Record<Tier, { selling: ListingRow[]; seeking: ListingRow[] }> = {
      premium: { selling: [], seeking: [] },
      trusted: { selling: [], seeking: [] },
      regular: { selling: [], seeking: [] },
    };
    for (const l of enriched) groups[tierOf(l)][l.kind].push(l);
    // Sort each bucket by rank (highest first) so top threads surface first.
    const byRank = (a: ListingRow, b: ListingRow) =>
      computeThreadRank(b.profile, b.created_at) - computeThreadRank(a.profile, a.created_at);
    for (const tier of Object.keys(groups) as Tier[]) {
      groups[tier].selling.sort(byRank);
      groups[tier].seeking.sort(byRank);
    }
    return { groups, total: enriched.length };
  });

// Admin: list every thread (any status) for moderation.
// Admin: list every thread (any status) for moderation, with author info.
export type AdminThreadRow = {
  id: string;
  user_id: string;
  kind: "selling" | "seeking";
  name: string;
  category: string;
  amount: number | null;
  currency: string | null;
  status: "active" | "inactive" | "sold";
  created_at: string;
  is_pinned: boolean;
  author: string;
  avatar_url: string | null;
  is_premium: boolean;
  is_trusted: boolean;
  is_banned: boolean;
};

async function assertStaff(userId: string) {
  const { data: role } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["admin", "moderator"]).maybeSingle();
  if (!role) throw new Error("Staff only");
}

export const adminListThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ threads: AdminThreadRow[] }> => {
    await assertStaff(context.userId);
    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("id,user_id,kind,name,category,amount,currency,status,created_at,is_pinned")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles")
          .select("user_id,display_name,avatar_url,is_premium,is_trusted,is_banned")
          .in("user_id", ids)
      : { data: [] as Array<{ user_id: string; display_name: string; avatar_url: string | null; is_premium: boolean; is_trusted: boolean; is_banned: boolean }> };
    const pm = new Map((profs ?? []).map((p) => [p.user_id, p]));
    const threads: AdminThreadRow[] = (data ?? []).map((r) => {
      const p = pm.get(r.user_id);
      return {
        id: r.id,
        user_id: r.user_id,
        kind: r.kind as "selling" | "seeking",
        name: r.name,
        category: r.category,
        amount: r.amount as number | null,
        currency: r.currency as string | null,
        status: r.status as "active" | "inactive" | "sold",
        created_at: r.created_at,
        is_pinned: !!(r as { is_pinned?: boolean }).is_pinned,
        author: p?.display_name ?? "Anon",
        avatar_url: p?.avatar_url ?? null,
        is_premium: !!p?.is_premium,
        is_trusted: !!p?.is_trusted,
        is_banned: !!p?.is_banned,
      };
    });
    return { threads };
  });

export const adminSetThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive", "sold"]) }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.from("listings").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.from("listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminPinThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), pinned: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { error } = await supabaseAdmin.from("listings").update({ is_pinned: data.pinned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBanThreadAuthor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.string().trim().min(2).max(500) }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const { data: listing, error: lerr } = await supabaseAdmin
      .from("listings").select("user_id").eq("id", data.id).maybeSingle();
    if (lerr) throw new Error(lerr.message);
    if (!listing) throw new Error("Thread not found");
    const { error: berr } = await supabaseAdmin.rpc("ban_user", {
      _target: listing.user_id, _caller: context.userId, _reason: data.reason,
    });
    if (berr) throw new Error(berr.message);
    await supabaseAdmin.from("listings")
      .update({ status: "inactive" }).eq("user_id", listing.user_id);
    return { ok: true };
  });

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      sort: z.enum(["newest", "active", "pinned"]).default("pinned"),
      kind: z.enum(["all", "selling", "seeking"]).default("all"),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(50).default(10),
    }),
  )
  .handler(async ({ data }) => {
    const { data: p, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id,display_name,avatar_url,telegram_username,is_premium,is_trusted,is_banned,suspended_until,trades_completed,rating_sum,rating_count,btc_volume_usd,created_at")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Profile not found");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin
      .from("listings")
      .select("id,kind,name,category,amount,currency,status,created_at,is_pinned", { count: "exact" })
      .eq("user_id", data.userId)
      .eq("status", "active");
    if (data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.sort === "newest") {
      q = q.order("created_at", { ascending: false });
    } else if (data.sort === "active") {
      // most recent activity = created_at (no last_bumped_at column yet)
      q = q.order("created_at", { ascending: false });
    } else {
      q = q.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    }
    const { data: rows, count } = await q.range(from, to);
    const ratingCount = p.rating_count ?? 0;
    const now = Date.now();
    const isBlocked = !!p.is_banned || !!(p.suspended_until && new Date(p.suspended_until).getTime() > now);
    return {
      profile: {
        user_id: p.user_id,
        display_name: p.display_name ?? "Anon",
        avatar_url: p.avatar_url,
        telegram_username: p.telegram_username,
        is_premium: !!p.is_premium,
        is_trusted: !!p.is_trusted,
        is_banned: !!p.is_banned,
        is_blocked: isBlocked,
        suspended_until: p.suspended_until ?? null,
        trades_completed: p.trades_completed ?? 0,
        rating_avg: ratingCount > 0 ? (p.rating_sum ?? 0) / ratingCount : null,
        rating_count: ratingCount,
        btc_volume_usd: Number(p.btc_volume_usd ?? 0),
        joined_at: p.created_at,
      },
      threads: isBlocked ? [] : (rows ?? []),
      totalCount: isBlocked ? 0 : (count ?? 0),
    };
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.enum(["selling", "seeking"]),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().min(5).max(2000),
      category: z.string().trim().min(2).max(60),
      amount: z.number().nonnegative().nullable().optional(),
      currency: z.string().trim().min(3).max(8).optional(),
      contact_telegram: z.string().trim().max(60).optional(),
      contact_website: z.string().trim().max(200).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("is_banned, suspended_until, telegram_username")
      .eq("user_id", userId)
      .maybeSingle();
    if (prof?.is_banned) throw new Error("Your account has been banned and cannot post new threads.");
    if (prof?.suspended_until && new Date(prof.suspended_until).getTime() > Date.now()) {
      throw new Error(`Your account is suspended until ${new Date(prof.suspended_until).toLocaleString()}.`);
    }
    // Auto-assign the linked Telegram username unless user explicitly overrode it
    const tg = (data.contact_telegram?.trim() || prof?.telegram_username || "").replace(/^@/, "");
    const { data: row, error } = await supabaseAdmin
      .from("listings")
      .insert({
        user_id: userId,
        kind: data.kind,
        name: data.name,
        description: data.description,
        category: data.category,
        amount: data.kind === "selling" ? data.amount ?? null : null,
        currency: data.currency ?? "USD",
        contact_telegram: tg || null,
        contact_website: data.contact_website || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { listings: data ?? [] };
  });

export const updateListingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive", "sold"]) }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("listings")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
