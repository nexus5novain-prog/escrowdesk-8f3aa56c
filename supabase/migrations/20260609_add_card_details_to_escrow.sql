-- Add card details columns to escrow_groups for BIN product purchases
ALTER TABLE public.escrow_groups
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS bin_number text,
  ADD COLUMN IF NOT EXISTS card_user text,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_bank text,
  ADD COLUMN IF NOT EXISTS card_country text,
  ADD COLUMN IF NOT EXISTS card_address text,
  ADD COLUMN IF NOT EXISTS cvv text,
  ADD COLUMN IF NOT EXISTS expire_date text;

-- Update RLS policy to include new columns in SELECT
GRANT SELECT (
  id, creator_id, counterparty_id, listing_id, listing_name, listing_category, trade_id,
  asset, amount, fiat_amount, fiat_currency,
  escrow_address, escrow_address_chain,
  deposit_tx_hash, status, telegram_chat_id,
  invited_telegram, invited_username,
  card_number, bin_number, card_user, card_type, card_brand, card_bank, card_country, card_address, cvv, expire_date,
  released_at, deposit_verified_at, created_at, updated_at
) ON public.escrow_groups TO authenticated;

-- Add cvv and expire_date columns to marketplace_products if they don't exist
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS cvv text,
  ADD COLUMN IF NOT EXISTS expire_date text;
