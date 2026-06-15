ALTER TABLE public.marketplace_products
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