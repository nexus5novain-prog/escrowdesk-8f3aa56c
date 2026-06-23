import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------- Profile (extended) ---------- */

export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [{ data: profile }, { data: policy }, { data: tokens }, { data: devices }, { data: events }, { data: prefs }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      context.supabase.from("user_withdrawal_policy").select("*").eq("user_id", uid).maybeSingle(),
      context.supabase.from("user_api_tokens").select("id,name,prefix,scopes,last_used_at,revoked_at,expires_at,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
      context.supabase.from("user_trusted_devices").select("id,device_fingerprint,label,user_agent,ip,last_seen_at,trusted_at,revoked_at").eq("user_id", uid).order("last_seen_at", { ascending: false }),
      context.supabase.from("user_security_events").select("id,kind,severity,ip,user_agent,metadata,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("notification_preferences").select("kind,in_app,telegram").eq("user_id", uid),
    ]);
    return {
      profile: profile ?? null,
      policy: policy ?? null,
      tokens: tokens ?? [],
      devices: devices ?? [],
      events: events ?? [],
      notification_prefs: prefs ?? [],
      email: context.claims?.email ?? null,
    };
  });

const profilePatch = z.object({
  display_name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().nullable().optional(),
  email_public: z.boolean().optional(),
  show_trade_history: z.boolean().optional(),
  show_online_status: z.boolean().optional(),
  default_withdrawal_method: z.enum(["lightning", "onchain"]).optional(),
  preferred_currency: z.string().min(2).max(8).optional(),
  timezone: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(16).optional(),
  wallet_address_btc: z.string().min(10).max(120).nullable().optional(),
});

export const updateMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profilePatch.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update(data).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "settings_changed", _severity: "info",
      _ip: null, _user_agent: null, _metadata: { fields: Object.keys(data) },
    } as never);
    return { ok: true };
  });

/* ---------- Withdrawal policy ---------- */

const policySchema = z.object({
  per_tx_limit_sats: z.number().int().min(1000).max(2_100_000_000_000_000).optional(),
  daily_limit_sats: z.number().int().min(1000).max(2_100_000_000_000_000).optional(),
  require_2fa_above_sats: z.number().int().min(0).optional(),
  whitelist_only: z.boolean().optional(),
  whitelist_addresses: z.array(z.string().min(8).max(120)).max(20).optional(),
  allowed_ip_cidrs: z.array(z.string().min(7).max(45)).max(10).optional(),
  notify_email: z.boolean().optional(),
  notify_telegram: z.boolean().optional(),
  cooldown_hours: z.number().int().min(0).max(168).optional(),
});

export const updateWithdrawalPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => policySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_withdrawal_policy")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "withdrawal_policy_changed", _severity: "warning",
      _ip: null, _user_agent: null, _metadata: { fields: Object.keys(data) },
    } as never);
    return { ok: true };
  });

/* ---------- API tokens ---------- */

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const createApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(2).max(60),
    scopes: z.array(z.enum(["read", "trade", "withdraw"])).min(1).max(3),
    expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const raw = `edk_${randomToken()}`;
    const prefix = raw.slice(0, 10);
    const hash = await sha256Hex(raw);
    const expires_at = data.expires_in_days
      ? new Date(Date.now() + data.expires_in_days * 86400_000).toISOString()
      : null;
    const { error } = await context.supabase.from("user_api_tokens").insert({
      user_id: context.userId, name: data.name, prefix, token_hash: hash,
      scopes: data.scopes, expires_at,
    });
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "token_created", _severity: "warning",
      _ip: null, _user_agent: null, _metadata: { name: data.name, scopes: data.scopes },
    } as never);
    return { token: raw, prefix };
  });

export const revokeApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "token_revoked", _severity: "info",
      _ip: null, _user_agent: null, _metadata: { token_id: data.id },
    } as never);
    return { ok: true };
  });

/* ---------- Trusted devices ---------- */

export const upsertTrustedDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    device_fingerprint: z.string().min(8).max(200),
    label: z.string().max(80).optional(),
    user_agent: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_trusted_devices").upsert({
      user_id: context.userId, ...data, last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,device_fingerprint" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeTrustedDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_trusted_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "device_removed", _severity: "warning",
      _ip: null, _user_agent: null, _metadata: { device_id: data.id },
    } as never);
    return { ok: true };
  });

/* ---------- Password change (re-auth via Supabase) ---------- */

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ new_password: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.new_password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("log_security_event" as never, {
      _user_id: context.userId, _kind: "password_change", _severity: "critical",
      _ip: null, _user_agent: null, _metadata: {},
    } as never);
    return { ok: true };
  });

/* ---------- Notification preferences ---------- */

export const updateNotificationPref = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.string().min(1).max(60),
    in_app: z.boolean().optional(),
    telegram: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_preferences").upsert({
      user_id: context.userId, kind: data.kind as never,
      in_app: data.in_app ?? true, telegram: data.telegram ?? true,
    }, { onConflict: "user_id,kind" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
