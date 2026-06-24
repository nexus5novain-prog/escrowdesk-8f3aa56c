# Phase 2 — Per-action TOTP for Telegram

Re-open the fund-moving and admin commands in the bot, but require a fresh
authenticator code as the last argument of every sensitive command. No
TOTP, no execution — and the website remains the only place where the TOTP
secret is ever seen.

## What the user sees

### Web — enable 2FA once
`/settings` gains a **Two-Factor Authentication** card:
1. Click **Enable 2FA** → server generates a base32 secret + otpauth URL.
2. UI shows a QR code (`qrcode.react`, already in deps) + the secret text for
   manual entry into Google Authenticator / Authy / 1Password.
3. User types the 6-digit code → server verifies, stores secret, marks
   `totp_enabled_at`, and shows **8 one-time recovery codes** (display once,
   hashed at rest).
4. Card afterwards shows status + **Disable 2FA** (requires a code) and
   **Regenerate recovery codes** (requires a code).

### Telegram — use 2FA per action
After enabling, sensitive commands take the code as the final argument:

```
/release TRADE_ID 123456
/dispute TRADE_ID reason text… 123456
/confirm TRADE_ID 123456
/sign    TRADE_ID PHRASE 123456
/terms   TRADE_ID terms text… 123456
/ban     USER_ID reason… 123456
/unban   USER_ID 123456
/warn    USER_ID severity reason… 123456
/fee     BPS 123456
```

- Missing/invalid code → friendly reply explaining how to enroll on the web.
- A 6-digit token = TOTP. An 8-char alphanumeric token = recovery code.
- Recovery codes are single-use; using one warns the user to regenerate.

## Security model

- **TOTP**: RFC 6238, SHA-1, 30-second period, 6 digits, ±1 step tolerance
  (so a code is valid for at most ~90s). Pure-JS HMAC via Node `crypto` —
  no new dependency.
- **Replay protection**: `totp_used_steps(user_id, step)` UNIQUE — a code
  can be redeemed at most once per user, even within its tolerance window.
- **Recovery codes**: 8 codes, format `XXXX-XXXX` (Crockford base32),
  stored as `sha256` hashes; consumed by deleting the matching hash row.
- **Secret storage**: `profiles.totp_secret` is `text`, restricted to
  `service_role` (revoke from `authenticated`/`anon`); never selected
  client-side. The server fn that enrolls returns the secret only on
  enrollment and never again.
- **Audit**: every sensitive Telegram command writes
  `user_security_events` with `kind` like `tg_release`, `tg_ban`,
  including success/failure and (on failure) the reason
  (`no_totp_enrolled`, `invalid_code`, `replayed_code`,
  `recovery_code_used`).
- **Banned users**: still blocked before the TOTP gate runs.
- **Brute-force**: 5 failed TOTP attempts within 15 minutes locks the
  Telegram bot for that user for 15 minutes (rolling). Tracked in
  `user_security_events`, no extra table needed.

## Technical details

### Migration `…_phase2_totp.sql`
```sql
alter table public.profiles
  add column totp_secret      text,
  add column totp_enabled_at  timestamptz,
  add column totp_last_step   bigint;

revoke select (totp_secret) on public.profiles from authenticated, anon;

create table public.totp_recovery_codes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, code_hash)
);
grant all on public.totp_recovery_codes to service_role;
alter table public.totp_recovery_codes enable row level security;
-- no policies → only service_role (which bypasses RLS) can read/write

create table public.totp_used_steps (
  user_id  uuid not null references auth.users(id) on delete cascade,
  step     bigint not null,
  used_at  timestamptz not null default now(),
  primary key (user_id, step)
);
grant all on public.totp_used_steps to service_role;
alter table public.totp_used_steps enable row level security;

-- house-keeping: prune steps older than 5 minutes opportunistically
create index on public.totp_used_steps (used_at);
```

### New files
- `src/lib/totp.server.ts` — pure-JS TOTP: `generateSecret()`,
  `otpauthURL()`, `verifyTotp(secret, code, lastStep)` returning
  `{ ok, step }`. ~60 LOC, no deps.
- `src/lib/totp.functions.ts` — `beginTotpEnroll` (returns secret +
  otpauth URL), `activateTotp({code})` (verifies, persists, returns
  recovery codes), `disableTotp({code})`, `regenerateRecoveryCodes({code})`.
  All `.middleware([requireSupabaseAuth])`.
- `src/components/TwoFactorCard.tsx` — `/settings` card with the QR/
  enroll/disable/recovery flows.

### Bot — `src/routes/api/public/telegram/webhook.ts`
Replace the Phase-2 gate block with a `requireTotp(profile, text)` helper
that:
1. Splits off the trailing token (6 digits or `XXXX-XXXX`).
2. Strips it from `text` so the existing command parsers run unchanged.
3. Calls `consumeTotp(user_id, token)` (service role) which:
   - rejects if `totp_enabled_at` is null,
   - tries TOTP first (verify + `totp_used_steps` insert; on conflict →
     `replayed_code`),
   - falls back to recovery code (`delete from totp_recovery_codes
     where user_id=$1 and code_hash=$2 returning 1`),
   - rate-limits via `user_security_events` counts,
   - writes the audit row.
4. On any failure returns a clear Telegram reply. Each gated command in
   the bot becomes a 3-line wrapper around the existing call.

The bot help text (`HELP_TOPICS` for `release`, `dispute`, `confirm`,
`sign`, `terms`, `ban`, `unban`, `warn`, `fee`) is updated to show the
TOTP argument and a one-liner: "Enable 2FA at escrowdesk.lovable.app →
Settings → Two-Factor Authentication."

### Notifications
`notify.server.ts` already exists. Add two new `NotificationKind`s used
by enrollment + recovery-code-used events so users see them in-app and
on Telegram (`security_2fa_enabled`, `security_recovery_code_used`).

## Out of scope (Phase 2)
- No SMS/email 2FA. Authenticator-app only.
- No WebAuthn / passkeys.
- TOTP is **not** required for `/balance`, `/trades`, `/help`, `/link`
  (read-only commands stay frictionless).
- Web app sign-in still uses email/password + Google as today; this PR
  only protects Telegram-initiated sensitive actions. Adding TOTP to web
  sign-in is a separate scope.

## Verification
1. Build passes.
2. Enroll 2FA from `/settings`, scan QR with an authenticator app.
3. From Telegram, `/release TRADE 123456` works; `/release TRADE` shows
   the enroll-hint; replaying the same code shows "code already used".
4. After 5 wrong codes, the bot locks the user for 15 min.
5. Use a recovery code in place of a TOTP — succeeds once, then fails on
   re-use; user gets a "recovery code used" notification on both web and
   Telegram.
