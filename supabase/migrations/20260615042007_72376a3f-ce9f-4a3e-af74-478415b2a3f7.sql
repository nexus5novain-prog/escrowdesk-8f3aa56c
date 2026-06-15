
-- Add listing/card metadata to escrow_groups
ALTER TABLE public.escrow_groups
  ADD COLUMN IF NOT EXISTS listing_name text,
  ADD COLUMN IF NOT EXISTS listing_category text,
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

-- Add card metadata to marketplace_products
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

CREATE INDEX IF NOT EXISTS idx_marketplace_products_bin_number ON public.marketplace_products(bin_number);

-- BIN metadata lookup table
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

DROP POLICY IF EXISTS "Anyone can read bin metadata" ON public.bin_metadata;
CREATE POLICY "Anyone can read bin metadata" ON public.bin_metadata
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage bin metadata" ON public.bin_metadata;
CREATE POLICY "Admins manage bin metadata" ON public.bin_metadata
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Shoutbox messages
CREATE TABLE IF NOT EXISTS public.shoutbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shoutbox_messages_created_at_idx ON public.shoutbox_messages (created_at DESC);

GRANT SELECT ON public.shoutbox_messages TO anon, authenticated;
GRANT INSERT, DELETE ON public.shoutbox_messages TO authenticated;
GRANT ALL ON public.shoutbox_messages TO service_role;

ALTER TABLE public.shoutbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shoutbox" ON public.shoutbox_messages;
CREATE POLICY "Anyone can read shoutbox" ON public.shoutbox_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can post" ON public.shoutbox_messages;
CREATE POLICY "Authenticated users can post" ON public.shoutbox_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.shoutbox_messages;
CREATE POLICY "Users can delete own messages" ON public.shoutbox_messages
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shoutbox_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shoutbox_messages';
  END IF;
END $$;
