
DELETE FROM public.wallet_transactions WHERE asset <> 'BTC';
DELETE FROM public.wallets WHERE asset <> 'BTC';
DELETE FROM public.offers WHERE asset <> 'BTC';
DELETE FROM public.trades WHERE asset <> 'BTC';
DELETE FROM public.escrow_groups WHERE asset <> 'BTC';

DROP FUNCTION IF EXISTS public.credit_wallet(uuid, public.asset_type, numeric, text);
DROP FUNCTION IF EXISTS public.debit_wallet(uuid, public.asset_type, numeric, text);
DROP FUNCTION IF EXISTS public.get_my_private_profile();

ALTER TYPE public.asset_type RENAME TO asset_type_old;
CREATE TYPE public.asset_type AS ENUM ('BTC');

ALTER TABLE public.wallets             ALTER COLUMN asset TYPE public.asset_type USING asset::text::public.asset_type;
ALTER TABLE public.wallet_transactions ALTER COLUMN asset TYPE public.asset_type USING asset::text::public.asset_type;
ALTER TABLE public.offers              ALTER COLUMN asset TYPE public.asset_type USING asset::text::public.asset_type;
ALTER TABLE public.trades              ALTER COLUMN asset TYPE public.asset_type USING asset::text::public.asset_type;
ALTER TABLE public.escrow_groups       ALTER COLUMN asset TYPE public.asset_type USING asset::text::public.asset_type;

DROP TYPE public.asset_type_old;

CREATE FUNCTION public.credit_wallet(_user uuid, _asset public.asset_type, _amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into wallets(user_id, asset, available) values (_user, _asset, _amount)
    on conflict (user_id, asset) do update set available = wallets.available + _amount;
  insert into wallet_transactions(user_id, asset, kind, amount, note) values (_user, _asset, 'adjustment', _amount, _note);
end; $$;

CREATE FUNCTION public.debit_wallet(_user uuid, _asset public.asset_type, _amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  update wallets set available = available - _amount where user_id=_user and asset=_asset and available >= _amount;
  if not found then raise exception 'Insufficient balance'; end if;
  insert into wallet_transactions(user_id, asset, kind, amount, note) values (_user, _asset, 'adjustment', -_amount, _note);
end; $$;

REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, public.asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid, public.asset_type, numeric, text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS wallet_address_usdt,
  DROP COLUMN IF EXISTS wallet_address_usdc,
  DROP COLUMN IF EXISTS wallet_address_usdc_chain,
  DROP COLUMN IF EXISTS wallet_address_eth;

CREATE FUNCTION public.get_my_private_profile()
RETURNS TABLE(wallet_address_btc text, telegram_user_id bigint, telegram_username text)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT wallet_address_btc, telegram_user_id, telegram_username
  FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict do nothing;
  insert into public.wallets (user_id, asset) values (new.id, 'BTC')
  on conflict do nothing;
  return new;
end;
$$;
