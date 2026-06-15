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
  bin_number text PRIMARY KEY,
  card_brand text,
  card_type text,
  card_bank text,
  card_country text,
  card_address text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bin_metadata TO anon, authenticated;
GRANT ALL ON public.bin_metadata TO service_role;

ALTER TABLE public.bin_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bin metadata" ON public.bin_metadata
  FOR SELECT USING (true);

CREATE POLICY "Admins manage bin metadata" ON public.bin_metadata
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));