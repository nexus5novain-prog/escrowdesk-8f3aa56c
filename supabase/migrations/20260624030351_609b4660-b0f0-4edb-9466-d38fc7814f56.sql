
-- 1) escrow_groups: drop sensitive card fields (deprecated table)
ALTER TABLE public.escrow_groups
  DROP COLUMN IF EXISTS card_number,
  DROP COLUMN IF EXISTS cvv,
  DROP COLUMN IF EXISTS expire_date,
  DROP COLUMN IF EXISTS card_address;

-- 2) profiles: column-level grants
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, user_id, display_name, avatar_url, bio,
  trades_completed, rating_sum, rating_count,
  is_premium, is_trusted, btc_volume_usd,
  distinct_partners, five_star_count,
  email_public, show_trade_history, show_online_status,
  preferred_currency, timezone, locale,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;

-- 3) marketplace_products: revoke sensitive columns
REVOKE SELECT ON public.marketplace_products FROM anon, authenticated;
GRANT SELECT (
  id, name, description, category, price, currency, image_url, stock,
  seller_wallet_address, seller_wallet_asset, status, is_featured,
  created_by, created_at, updated_at,
  bin_number, card_user, card_type, card_brand, card_bank, card_country,
  card_style, is_seeded
) ON public.marketplace_products TO authenticated;

-- 4) Storage: ads bucket — staff-only read
DROP POLICY IF EXISTS "Authenticated users read ads files" ON storage.objects;
CREATE POLICY "Staff read ads files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ads'
    AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'moderator'::app_role))
  );

-- 5) Storage: avatars bucket — drop broad listing policy (public CDN reads still work)
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;

-- 6) SECURITY DEFINER: revoke EXECUTE from anon/authenticated/PUBLIC on all public funcs,
--    then re-grant only the small set used by RLS / explicitly user-callable.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END$$;

-- Re-grant for RLS helpers + user-callable helper
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_arbiter(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_party(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;
