-- Add BIN metadata support and link marketplace products to escrow groups

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS card_number text,
  ADD COLUMN IF NOT EXISTS bin_number text,
  ADD COLUMN IF NOT EXISTS card_user text,
  ADD COLUMN IF NOT EXISTS card_type text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS card_bank text,
  ADD COLUMN IF NOT EXISTS card_country text,
  ADD COLUMN IF NOT EXISTS card_address text;

CREATE TABLE IF NOT EXISTS public.bin_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_number text NOT NULL UNIQUE,
  card_brand text,
  card_type text,
  card_bank text,
  card_country text,
  card_address text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_groups
  ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES public.marketplace_products(id),
  ADD COLUMN IF NOT EXISTS listing_name text,
  ADD COLUMN IF NOT EXISTS listing_category text;

CREATE INDEX IF NOT EXISTS idx_marketplace_products_bin_number ON public.marketplace_products(bin_number);
CREATE INDEX IF NOT EXISTS idx_escrow_groups_listing_id ON public.escrow_groups(listing_id);
CREATE INDEX IF NOT EXISTS idx_bin_metadata_bin_number ON public.bin_metadata(bin_number);
