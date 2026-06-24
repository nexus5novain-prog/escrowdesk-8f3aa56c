// Server functions for 2FA enrollment / disable / recovery-code regen.
// All require the signed-in user.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({ code: z.string().min(6).max(20) });

// In-memory pending enrolment per user. Lost on cold start; that's fine —
// the user just clicks "Enable 2FA" again.
const PENDING = new Map<string, { secret: string; expires: number }>();
function setPending(uid: string, secret: string) {
  PENDING.set(uid, { secret, expires: Date.now() + 10 * 60_000 });
}
function takePending(uid: string): string | null {
  const e = PENDING.get(uid);
  if (!e) return null;
  if (e.expires < Date.now()) { PENDING.delete(uid); return null; }
  return e.secret;
}

export const getTotpStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("totp_enabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { count } = await supabaseAdmin
      .from("totp_recovery_codes")
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    return {
      enabled: Boolean(prof?.totp_enabled_at),
      enabled_at: prof?.totp_enabled_at ?? null,
      recovery_codes_remaining: count ?? 0,
    };
  });

export const beginTotpEnroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateSecret, otpauthURL } = await import("@/lib/totp.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("totp_enabled_at, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (prof?.totp_enabled_at) throw new Error("2FA already enabled — disable it first");

    const secret = generateSecret();
    setPending(context.userId, secret);
    const account = prof?.display_name || context.userId.slice(0, 8);
    return {
      secret,
      otpauth: otpauthURL(secret, account),
    };
  });

export const activateTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyTotp, generateRecoveryCodes, hashRecoveryCode } =
      await import("@/lib/totp.server");

    const secret = takePending(context.userId);
    if (!secret) throw new Error("Enrolment expired — start again");

    const step = verifyTotp(secret, data.code.trim());
    if (step == null) throw new Error("Invalid code — check the time on your authenticator");

    const now = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ totp_secret: secret, totp_enabled_at: now, totp_last_step: step })
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);

    // Replace recovery codes
    await supabaseAdmin.from("totp_recovery_codes").delete().eq("user_id", context.userId);
    const codes = generateRecoveryCodes(8);
    const rows = codes.map((c) => ({ user_id: context.userId, code_hash: hashRecoveryCode(c) }));
    await supabaseAdmin.from("totp_recovery_codes").insert(rows);

    await supabaseAdmin.from("user_security_events").insert({
      user_id: context.userId,
      kind: "totp_enabled",
      severity: "info",
    });
    PENDING.delete(context.userId);

    // Best-effort notification
    try {
      const { notifyUser } = await import("@/lib/notify.server");
      await notifyUser({
        userId: context.userId,
        kind: "system",
        title: "Two-factor authentication enabled",
        body: "Telegram fund-moving and admin actions now require a 6-digit code.",
        link: "/settings",
      });
    } catch { /* notify failure is non-fatal */ }

    return { ok: true, recovery_codes: codes };
  });

export const disableTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyTotp, hashRecoveryCode, isRecoveryCodeFormat } =
      await import("@/lib/totp.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("totp_secret, totp_enabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.totp_enabled_at || !prof.totp_secret) throw new Error("2FA is not enabled");

    const code = data.code.trim();
    let ok = false;
    if (/^\d{6}$/.test(code)) {
      ok = verifyTotp(prof.totp_secret, code) != null;
    } else if (isRecoveryCodeFormat(code)) {
      const { data: del } = await supabaseAdmin
        .from("totp_recovery_codes")
        .delete()
        .eq("user_id", context.userId)
        .eq("code_hash", hashRecoveryCode(code))
        .select("user_id");
      ok = (del?.length ?? 0) > 0;
    }
    if (!ok) throw new Error("Invalid code");

    await supabaseAdmin
      .from("profiles")
      .update({ totp_secret: null, totp_enabled_at: null, totp_last_step: null })
      .eq("user_id", context.userId);
    await supabaseAdmin.from("totp_recovery_codes").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("totp_used_steps").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("user_security_events").insert({
      user_id: context.userId,
      kind: "totp_disabled",
      severity: "warning",
    });
    return { ok: true };
  });

export const regenerateRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyTotp, generateRecoveryCodes, hashRecoveryCode } =
      await import("@/lib/totp.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("totp_secret, totp_enabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!prof?.totp_enabled_at || !prof.totp_secret) throw new Error("2FA is not enabled");

    if (verifyTotp(prof.totp_secret, data.code.trim()) == null) {
      throw new Error("Invalid code");
    }
    await supabaseAdmin.from("totp_recovery_codes").delete().eq("user_id", context.userId);
    const codes = generateRecoveryCodes(8);
    await supabaseAdmin.from("totp_recovery_codes").insert(
      codes.map((c) => ({ user_id: context.userId, code_hash: hashRecoveryCode(c) })),
    );
    return { recovery_codes: codes };
  });
