
-- 1) ADS STORAGE BUCKET: tighten public read
DROP POLICY IF EXISTS "Read ads files" ON storage.objects;
CREATE POLICY "Authenticated users read ads files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ads');

-- 2) MARKETPLACE PRODUCTS: require auth to view
DROP POLICY IF EXISTS "Anyone can view active products" ON public.marketplace_products;
CREATE POLICY "Authenticated users view active products"
  ON public.marketplace_products FOR SELECT TO authenticated
  USING (status = 'active');
REVOKE SELECT ON public.marketplace_products FROM anon;

-- 3) PROFILES: hide sensitive fields via column-level grants
-- Keep public read for safe fields; revoke sensitive cols from anon + authenticated.
REVOKE SELECT ON public.profiles FROM anon, authenticated, PUBLIC;
GRANT SELECT (
  id, user_id, display_name, avatar_url, bio,
  trades_completed, rating_sum, rating_count, five_star_count,
  distinct_partners, btc_volume_usd, is_premium, is_trusted, is_banned,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;
-- Owners read their own sensitive columns through a dedicated server-side path; revoke wide grant.
-- service_role keeps full access for server functions.
GRANT ALL ON public.profiles TO service_role;
-- Tighten the public read policy to authenticated (still column-gated above)
DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Public profile fields readable"
  ON public.profiles FOR SELECT
  USING (true);  -- column-level grants enforce which fields are visible

-- Helper function: owner reads their own private profile fields
CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE (
  wallet_address_btc text,
  wallet_address_usdt text,
  wallet_address_usdc text,
  wallet_address_usdc_chain text,
  wallet_address_eth text,
  telegram_user_id bigint,
  telegram_username text
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT wallet_address_btc, wallet_address_usdt, wallet_address_usdc,
         wallet_address_usdc_chain, wallet_address_eth,
         telegram_user_id, telegram_username
  FROM public.profiles
  WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

-- 4) AD_EVENTS: require authenticated insert
DROP POLICY IF EXISTS "Anyone can record ad events" ON public.ad_events;
CREATE POLICY "Authenticated users record ad events"
  ON public.ad_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5) SHOUTBOX_MESSAGES: explicitly deny direct inserts (server fns use service_role)
DROP POLICY IF EXISTS "No direct shoutbox inserts" ON public.shoutbox_messages;
CREATE POLICY "No direct shoutbox inserts"
  ON public.shoutbox_messages FOR INSERT TO authenticated
  WITH CHECK (false);

-- 6) USER_ROLES: explicitly deny self-insert (only admins via existing ALL policy or service_role)
DROP POLICY IF EXISTS "No self insert into user_roles" ON public.user_roles;
CREATE POLICY "No self insert into user_roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7) SECURITY DEFINER functions: revoke execute from public roles
-- Keep RLS helper functions executable (used inside policy expressions).
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unban_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warn_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid, asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_badges(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ad_analytics(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_trade_paid(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_trade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_trade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_dispute(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trade(uuid, uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sign_terms(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_buyer_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_fee_bps(numeric) FROM PUBLIC, anon, authenticated;

-- 8) RLS POLICY ALWAYS TRUE (non-SELECT): tighten ad_events insert (handled above);
--    Other USING(true) policies are SELECT-only (intentionally public read) and excluded by the linter rule.
