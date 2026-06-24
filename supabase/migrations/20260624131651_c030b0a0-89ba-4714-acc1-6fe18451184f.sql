
-- Phase 3: Telegram as a mobile client — schema additions

alter table public.profiles
  add column if not exists tg_pending_prompts jsonb not null default '{}'::jsonb,
  add column if not exists tg_withdraw_daily_cap_sats bigint;

alter table public.deposit_requests
  add column if not exists tg_chat_id bigint,
  add column if not exists tg_message_id bigint;

alter table public.withdrawal_requests
  add column if not exists tg_chat_id bigint,
  add column if not exists tg_message_id bigint;

-- Convenience: a per-user 24h withdrawal sum (sats), excluding cancelled/rejected.
create or replace function public.tg_withdrawal_24h_sats(_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_sats), 0)::bigint
  from public.withdrawal_requests
  where user_id = _user
    and created_at >= now() - interval '24 hours'
    and status not in ('cancelled','rejected','failed');
$$;

revoke execute on function public.tg_withdrawal_24h_sats(uuid) from public, anon, authenticated;
