-- Phase 2: TOTP (per-action 2FA) infrastructure

alter table public.profiles
  add column if not exists totp_secret      text,
  add column if not exists totp_enabled_at  timestamptz,
  add column if not exists totp_last_step   bigint;

-- Keep clients out of the secret column entirely.
revoke select (totp_secret) on public.profiles from anon;
revoke select (totp_secret) on public.profiles from authenticated;

-- Recovery codes (hashed, single-use)
create table if not exists public.totp_recovery_codes (
  user_id     uuid not null references auth.users(id) on delete cascade,
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, code_hash)
);
grant all on public.totp_recovery_codes to service_role;
alter table public.totp_recovery_codes enable row level security;
-- intentionally no policies: only service_role (which bypasses RLS) accesses this table

-- Used TOTP steps (replay protection — a 30s step can be redeemed at most once per user)
create table if not exists public.totp_used_steps (
  user_id  uuid not null references auth.users(id) on delete cascade,
  step     bigint not null,
  used_at  timestamptz not null default now(),
  primary key (user_id, step)
);
grant all on public.totp_used_steps to service_role;
alter table public.totp_used_steps enable row level security;
create index if not exists totp_used_steps_used_at_idx on public.totp_used_steps (used_at);
