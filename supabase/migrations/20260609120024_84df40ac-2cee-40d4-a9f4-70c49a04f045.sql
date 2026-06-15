DROP POLICY IF EXISTS "Staff read pm" ON public.payment_methods;
CREATE POLICY "Finance/admin read pm" ON public.payment_methods
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'finance'));

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, user_id, display_name, avatar_url, bio,
  trades_completed, rating_sum, rating_count,
  is_banned, ban_reason, banned_at, banned_by,
  is_premium, is_trusted,
  btc_volume_usd, distinct_partners, five_star_count,
  created_at, updated_at
) ON public.profiles TO anon, authenticated;

REVOKE SELECT ON public.escrow_groups FROM anon, authenticated;
GRANT SELECT (
  id, creator_id, counterparty_id, listing_id, trade_id,
  asset, amount, fiat_amount, fiat_currency,
  escrow_address, escrow_address_chain,
  deposit_tx_hash, status, telegram_chat_id,
  invited_telegram, invited_username,
  released_at, deposit_verified_at, created_at, updated_at
) ON public.escrow_groups TO authenticated;