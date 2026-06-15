
-- ============ PROFILE EXTENSIONS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trusted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wallet_address_btc text,
  ADD COLUMN IF NOT EXISTS wallet_address_usdt text,
  ADD COLUMN IF NOT EXISTS wallet_address_usdc text,
  ADD COLUMN IF NOT EXISTS wallet_address_usdc_chain text DEFAULT 'ERC20',
  ADD COLUMN IF NOT EXISTS wallet_address_eth text,
  ADD COLUMN IF NOT EXISTS btc_volume_usd numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distinct_partners integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS five_star_count integer NOT NULL DEFAULT 0;

-- ============ TRADE EXTENSIONS ============
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS terms_seller text,
  ADD COLUMN IF NOT EXISTS terms_buyer text,
  ADD COLUMN IF NOT EXISTS signature_seller text,
  ADD COLUMN IF NOT EXISTS signature_buyer text,
  ADD COLUMN IF NOT EXISTS signed_by_seller_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by_buyer_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_tx_hash text,
  ADD COLUMN IF NOT EXISTS buyer_payout_address text,
  ADD COLUMN IF NOT EXISTS seller_payout_address text;

-- ============ FEE LADDER SEED ============
INSERT INTO public.platform_settings(key, value)
VALUES ('fee_tiers', '[{"max":20,"bps":200},{"max":50,"bps":300},{"max":100,"bps":500},{"max":250,"bps":700},{"max":1000,"bps":900},{"max":null,"bps":1000}]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ STAFF HELPER (extended roles) ============
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','moderator','judge','finance','support'));
$$;

-- ============ USER WARNINGS ============
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issued_by uuid NOT NULL,
  reason text NOT NULL,
  severity text NOT NULL DEFAULT 'minor',
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_warnings TO authenticated;
GRANT ALL ON public.user_warnings TO service_role;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own warnings" ON public.user_warnings FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Staff issue warnings" ON public.user_warnings FOR INSERT
  WITH CHECK (issued_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator') OR public.has_role(auth.uid(),'judge')));
CREATE POLICY "Admins update warnings" ON public.user_warnings FOR UPDATE USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete warnings" ON public.user_warnings FOR DELETE USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings(user_id, created_at DESC);

-- ============ LISTINGS ============
DO $$ BEGIN CREATE TYPE listing_kind AS ENUM ('selling','seeking'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listing_status AS ENUM ('active','inactive','sold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind listing_kind NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric(24,2),
  currency text DEFAULT 'USD',
  contact_telegram text,
  contact_website text,
  status listing_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active listings" ON public.listings FOR SELECT
  USING (status = 'active' OR auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE POLICY "Owner inserts own listing" ON public.listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own listing" ON public.listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff updates any listing" ON public.listings FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "Owner deletes own listing" ON public.listings FOR DELETE USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_listings_status_kind ON public.listings(status, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user ON public.listings(user_id);
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRADE RATINGS ============
CREATE TABLE IF NOT EXISTS public.trade_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL,
  rater_id uuid NOT NULL,
  ratee_id uuid NOT NULL,
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, rater_id)
);
GRANT SELECT ON public.trade_ratings TO anon, authenticated;
GRANT INSERT ON public.trade_ratings TO authenticated;
GRANT ALL ON public.trade_ratings TO service_role;
ALTER TABLE public.trade_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings publicly readable" ON public.trade_ratings FOR SELECT USING (true);
CREATE POLICY "Participants insert ratings" ON public.trade_ratings FOR INSERT
  WITH CHECK (
    rater_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.trades t WHERE t.id = trade_ratings.trade_id AND t.status = 'released'
        AND ((t.buyer_id = auth.uid() AND t.seller_id = ratee_id) OR (t.seller_id = auth.uid() AND t.buyer_id = ratee_id))
    )
  );
CREATE INDEX IF NOT EXISTS idx_trade_ratings_ratee ON public.trade_ratings(ratee_id);

-- ============ ESCROW GROUPS ============
DO $$ BEGIN CREATE TYPE escrow_group_status AS ENUM ('awaiting_counterparty','active','funded','released','cancelled','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE escrow_member_role AS ENUM ('buyer','seller','moderator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.escrow_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  counterparty_id uuid,
  invited_telegram text,
  invited_username text,
  listing_id uuid,
  trade_id uuid,
  asset asset_type NOT NULL,
  amount numeric(24,8) NOT NULL,
  fiat_amount numeric(24,2),
  fiat_currency text NOT NULL DEFAULT 'USD',
  escrow_address text,
  escrow_address_chain text,
  deposit_tx_hash text,
  status escrow_group_status NOT NULL DEFAULT 'awaiting_counterparty',
  telegram_chat_id bigint,
  telegram_link_token text UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  released_at timestamptz,
  deposit_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escrow_groups TO authenticated;
GRANT ALL ON public.escrow_groups TO service_role;

CREATE TABLE IF NOT EXISTS public.escrow_group_members (
  group_id uuid NOT NULL REFERENCES public.escrow_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role escrow_member_role NOT NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escrow_group_members TO authenticated;
GRANT ALL ON public.escrow_group_members TO service_role;

CREATE TABLE IF NOT EXISTS public.escrow_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.escrow_groups(id) ON DELETE CASCADE,
  sender_id uuid,
  body text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  from_telegram boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.escrow_group_messages TO authenticated;
GRANT ALL ON public.escrow_group_messages TO service_role;

CREATE INDEX IF NOT EXISTS idx_egm_group ON public.escrow_group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_eg_creator ON public.escrow_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_eg_counterparty ON public.escrow_groups(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_egmem_user ON public.escrow_group_members(user_id);

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.escrow_group_members WHERE group_id=_group AND user_id=_user)
$$;

ALTER TABLE public.escrow_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group readable by members or staff" ON public.escrow_groups FOR SELECT USING (
  creator_id = auth.uid() OR counterparty_id = auth.uid() OR public.is_group_member(id, auth.uid()) OR public.is_staff(auth.uid())
);
CREATE POLICY "Members read membership" ON public.escrow_group_members FOR SELECT USING (
  user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()) OR public.is_staff(auth.uid())
);
CREATE POLICY "Members read messages" ON public.escrow_group_messages FOR SELECT USING (
  public.is_group_member(group_id, auth.uid()) OR public.is_staff(auth.uid())
);
CREATE POLICY "Members send messages" ON public.escrow_group_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND public.is_group_member(group_id, auth.uid())
);

CREATE TRIGGER trg_escrow_groups_touch BEFORE UPDATE ON public.escrow_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AD BANNERS ============
CREATE TABLE IF NOT EXISTS public.ad_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image','video','html')),
  media_url text,
  html_content text,
  link_url text,
  placements text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_banners TO anon, authenticated;
GRANT ALL ON public.ad_banners TO service_role;
ALTER TABLE public.ad_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active ads" ON public.ad_banners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage ads" ON public.ad_banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ad_banners_updated BEFORE UPDATE ON public.ad_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_ad_banners_active ON public.ad_banners(is_active, priority DESC);

-- ============ MARKETPLACE PRODUCTS ============
CREATE TABLE IF NOT EXISTS public.marketplace_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  price numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  image_url text,
  stock int NOT NULL DEFAULT -1,
  seller_wallet_address text,
  seller_wallet_asset text DEFAULT 'USDT',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','sold_out')),
  is_featured boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_products TO anon, authenticated;
GRANT ALL ON public.marketplace_products TO service_role;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.marketplace_products FOR SELECT USING (status = 'active');
CREATE POLICY "Admins manage products" ON public.marketplace_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_marketplace_products_updated BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_marketplace_products_status ON public.marketplace_products(status, is_featured DESC, created_at DESC);
