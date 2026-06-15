ALTER TABLE public.escrow_groups
  ADD COLUMN IF NOT EXISTS listing_name text,
  ADD COLUMN IF NOT EXISTS listing_category text;

GRANT SELECT (
  id, creator_id, counterparty_id, listing_id, listing_name, listing_category, trade_id,
  asset, amount, fiat_amount, fiat_currency,
  escrow_address, escrow_address_chain,
  deposit_tx_hash, status, telegram_chat_id,
  invited_telegram, invited_username,
  released_at, deposit_verified_at, created_at, updated_at
) ON public.escrow_groups TO authenticated;