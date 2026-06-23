
-- ============ 1. Column-level secrecy on profiles ============
-- Keep the public profile policy (display_name, avatar_url, bio, ratings remain readable),
-- but revoke column-level SELECT on sensitive fields from anon and authenticated.
-- Server functions using the service role still have full access.
REVOKE SELECT (telegram_user_id, telegram_username,
               wallet_address_btc, wallet_address_usdt, wallet_address_usdc,
               wallet_address_usdc_chain, wallet_address_eth)
  ON public.profiles FROM anon, authenticated;

-- ============ 2. Column-level secrecy on marketplace_products ============
REVOKE SELECT (card_number, cvv, expire_date, card_address, card_user, bin_number,
               card_type, card_brand, card_bank, card_country)
  ON public.marketplace_products FROM anon, authenticated;

-- ============ 3. Avatars bucket: stop allowing listing ============
-- Public buckets serve files via the public URL without going through RLS,
-- so dropping this broad SELECT policy keeps avatars viewable while preventing
-- enumeration / listing of all files.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- ============ 4. Revoke EXECUTE on privileged SECURITY DEFINER functions ============
-- These are invoked only by the backend (service_role) via supabaseAdmin.rpc.
-- service_role retains EXECUTE; policy-/trigger-used helpers (has_role, is_staff,
-- is_group_member, compute_fee_bps, handle_new_user, update_updated_at_column,
-- tg_trade_ratings_after_insert, tg_user_roles_recompute) are intentionally left
-- callable so RLS evaluation and triggers continue to work.
REVOKE EXECUTE ON FUNCTION public.assign_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ban_user(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unban_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.warn_user(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(uuid, public.asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_wallet(uuid, public.asset_type, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_trade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_buyer_deposit(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_trade_paid(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.open_dispute(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_trade(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sign_terms(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trade(uuid, uuid, numeric, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_user_badges(uuid) FROM PUBLIC, anon, authenticated;

-- ============ 5. Realtime channel authorization ============
-- Enable RLS on realtime.messages and scope subscriptions per channel topic so
-- users can only subscribe to channels they're allowed to receive.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized realtime read" ON realtime.messages;
CREATE POLICY "Authorized realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Per-user private channels: topic must include the caller's own uid
  (realtime.topic() = 'trades-live-' || auth.uid()::text)
  OR (realtime.topic() = 'wallet-live-' || auth.uid()::text)
  OR (realtime.topic() = 'header-roles-' || auth.uid()::text)

  -- Public lists (no sensitive row payload exposed beyond what RLS already permits)
  OR realtime.topic() IN ('products-live', 'shoutbox-public')
  OR realtime.topic() LIKE 'ads-%'

  -- Staff-only admin channels
  OR (realtime.topic() IN ('admin-users-live','admin-ads-live','admin-products-live')
      AND public.is_staff(auth.uid()))

  -- Per-trade channel: 'trade:<uuid>' — only buyer, seller, or staff
  OR (
    realtime.topic() LIKE 'trade:%'
    AND EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.id::text = substring(realtime.topic() from 7)
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid() OR public.is_staff(auth.uid()))
    )
  )

  -- Per-escrow-group channel: 'eg:<uuid>' — only members or staff
  OR (
    realtime.topic() LIKE 'eg:%'
    AND (
      public.is_staff(auth.uid())
      OR public.is_group_member(substring(realtime.topic() from 4)::uuid, auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "No realtime writes from clients" ON realtime.messages;
CREATE POLICY "No realtime writes from clients"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);
