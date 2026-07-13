-- =============================================================
-- Novain Escrowdesk + Declutter: platform-level schema
-- =============================================================

-- 1) Escrow deal type enum ------------------------------------
DO $$ BEGIN
  CREATE TYPE public.escrow_deal_type AS ENUM (
    'marketplace','product','service','vehicle','property',
    'freelance','invoice','business','import_export','construction',
    'milestone','digital_product','domain','website','software',
    'crypto','equipment','trade','investment','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.escrow_deal_status AS ENUM (
    'draft','invited','accepted','terms_pending','funded',
    'in_progress','delivered','inspecting','released',
    'disputed','cancelled','refunded','settled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.escrow_party_role AS ENUM ('buyer','seller','mediator','observer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) escrow_deals (Escrow Portal — independent of marketplace) -
CREATE TABLE IF NOT EXISTS public.escrow_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('ND-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_type public.escrow_deal_type NOT NULL,
  status public.escrow_deal_status NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text,
  terms text,
  currency text NOT NULL DEFAULT 'BTC',
  amount numeric(20,8) NOT NULL,
  buyer_id uuid REFERENCES auth.users(id),
  seller_id uuid REFERENCES auth.users(id),
  buyer_email text,
  seller_email text,
  location_country text,
  location_state text,
  location_city text,
  expected_delivery_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (amount > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escrow_deals TO authenticated;
GRANT ALL ON public.escrow_deals TO service_role;
ALTER TABLE public.escrow_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deal participants can read" ON public.escrow_deals
  FOR SELECT TO authenticated
  USING (
    auth.uid() = creator_id
    OR auth.uid() = buyer_id
    OR auth.uid() = seller_id
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'moderator')
  );

CREATE POLICY "creator can insert own deal" ON public.escrow_deals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "creator can update draft deal" ON public.escrow_deals
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id AND status IN ('draft','invited','terms_pending'))
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "staff can manage deals" ON public.escrow_deals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX IF NOT EXISTS idx_escrow_deals_creator ON public.escrow_deals(creator_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_buyer   ON public.escrow_deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_seller  ON public.escrow_deals(seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_status  ON public.escrow_deals(status);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_escrow_deals_updated ON public.escrow_deals;
CREATE TRIGGER trg_escrow_deals_updated
  BEFORE UPDATE ON public.escrow_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) escrow_invitations (invite link + optional email) ---------
CREATE TABLE IF NOT EXISTS public.escrow_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.escrow_party_role NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  invited_email text,
  accepted_by uuid REFERENCES auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escrow_invitations TO authenticated;
GRANT ALL ON public.escrow_invitations TO service_role;
ALTER TABLE public.escrow_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inviter or invitee can read" ON public.escrow_invitations
  FOR SELECT TO authenticated
  USING (auth.uid() = invited_by OR auth.uid() = accepted_by OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "inviter can create" ON public.escrow_invitations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = invited_by);

CREATE POLICY "invitee can accept" ON public.escrow_invitations
  FOR UPDATE TO authenticated
  USING (accepted_by IS NULL AND expires_at > now())
  WITH CHECK (accepted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_escrow_invitations_deal ON public.escrow_invitations(deal_id);
CREATE INDEX IF NOT EXISTS idx_escrow_invitations_token ON public.escrow_invitations(token);

-- 4) Location hierarchy (light, seedable) ----------------------
CREATE TABLE IF NOT EXISTS public.regions (
  code text PRIMARY KEY,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.regions TO anon, authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions readable" ON public.regions FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.countries (
  code text PRIMARY KEY,           -- ISO 3166-1 alpha-2
  name text NOT NULL,
  region_code text NOT NULL REFERENCES public.regions(code),
  currency text,
  phone_prefix text,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_countries_region ON public.countries(region_code);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries readable" ON public.countries FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  UNIQUE (country_code, name)
);
CREATE INDEX IF NOT EXISTS idx_states_country ON public.states(country_code);
GRANT SELECT ON public.states TO anon, authenticated;
GRANT ALL ON public.states TO service_role;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "states readable" ON public.states FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id uuid NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (state_id, name)
);
CREATE INDEX IF NOT EXISTS idx_cities_state ON public.cities(state_id);
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cities readable" ON public.cities FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  postal_code text,
  UNIQUE (city_id, name)
);
CREATE INDEX IF NOT EXISTS idx_areas_city ON public.areas(city_id);
GRANT SELECT ON public.areas TO anon, authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas readable" ON public.areas FOR SELECT TO anon, authenticated USING (true);

-- Seed regions + a starter set of countries -------------------
INSERT INTO public.regions(code,name,sort_order) VALUES
  ('AF','Africa',1),('EU','Europe',2),('NA','North America',3),
  ('SA','South America',4),('AS','Asia',5),('OC','Oceania',6),('AN','Antarctica',7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.countries(code,name,region_code,currency,phone_prefix) VALUES
  ('NG','Nigeria','AF','NGN','+234'),
  ('GH','Ghana','AF','GHS','+233'),
  ('KE','Kenya','AF','KES','+254'),
  ('ZA','South Africa','AF','ZAR','+27'),
  ('EG','Egypt','AF','EGP','+20'),
  ('US','United States','NA','USD','+1'),
  ('CA','Canada','NA','CAD','+1'),
  ('MX','Mexico','NA','MXN','+52'),
  ('GB','United Kingdom','EU','GBP','+44'),
  ('DE','Germany','EU','EUR','+49'),
  ('FR','France','EU','EUR','+33'),
  ('ES','Spain','EU','EUR','+34'),
  ('IT','Italy','EU','EUR','+39'),
  ('NL','Netherlands','EU','EUR','+31'),
  ('BR','Brazil','SA','BRL','+55'),
  ('AR','Argentina','SA','ARS','+54'),
  ('IN','India','AS','INR','+91'),
  ('CN','China','AS','CNY','+86'),
  ('JP','Japan','AS','JPY','+81'),
  ('SG','Singapore','AS','SGD','+65'),
  ('AE','United Arab Emirates','AS','AED','+971'),
  ('AU','Australia','OC','AUD','+61'),
  ('NZ','New Zealand','OC','NZD','+64')
ON CONFLICT (code) DO NOTHING;

-- 5) Privilege escalation fix on profiles ---------------------
-- Trigger blocks self-updates to security/trust/reputation columns.
CREATE OR REPLACE FUNCTION public.profiles_block_sensitive_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  -- Service role / no-auth contexts skip
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')
    INTO is_staff;
  IF is_staff THEN RETURN NEW; END IF;

  -- Only enforce when user is updating their OWN row
  IF NEW.user_id <> auth.uid() THEN RETURN NEW; END IF;

  IF NEW.is_trusted        IS DISTINCT FROM OLD.is_trusted        THEN NEW.is_trusted        := OLD.is_trusted;        END IF;
  IF NEW.is_premium        IS DISTINCT FROM OLD.is_premium        THEN NEW.is_premium        := OLD.is_premium;        END IF;
  IF NEW.is_banned         IS DISTINCT FROM OLD.is_banned         THEN NEW.is_banned         := OLD.is_banned;         END IF;
  IF NEW.banned_at         IS DISTINCT FROM OLD.banned_at         THEN NEW.banned_at         := OLD.banned_at;         END IF;
  IF NEW.ban_reason        IS DISTINCT FROM OLD.ban_reason        THEN NEW.ban_reason        := OLD.ban_reason;        END IF;
  IF NEW.totp_secret       IS DISTINCT FROM OLD.totp_secret       THEN NEW.totp_secret       := OLD.totp_secret;       END IF;
  IF NEW.totp_enabled_at   IS DISTINCT FROM OLD.totp_enabled_at   THEN NEW.totp_enabled_at   := OLD.totp_enabled_at;   END IF;
  IF NEW.totp_last_step    IS DISTINCT FROM OLD.totp_last_step    THEN NEW.totp_last_step    := OLD.totp_last_step;    END IF;
  IF NEW.tg_withdraw_daily_cap_sats IS DISTINCT FROM OLD.tg_withdraw_daily_cap_sats
     THEN NEW.tg_withdraw_daily_cap_sats := OLD.tg_withdraw_daily_cap_sats; END IF;
  IF NEW.five_star_count   IS DISTINCT FROM OLD.five_star_count   THEN NEW.five_star_count   := OLD.five_star_count;   END IF;
  IF NEW.rating_sum        IS DISTINCT FROM OLD.rating_sum        THEN NEW.rating_sum        := OLD.rating_sum;        END IF;
  IF NEW.rating_count      IS DISTINCT FROM OLD.rating_count      THEN NEW.rating_count      := OLD.rating_count;      END IF;
  IF NEW.trades_completed  IS DISTINCT FROM OLD.trades_completed  THEN NEW.trades_completed  := OLD.trades_completed;  END IF;
  IF NEW.btc_volume_usd    IS DISTINCT FROM OLD.btc_volume_usd    THEN NEW.btc_volume_usd    := OLD.btc_volume_usd;    END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.profiles_block_sensitive_self_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_block_sensitive_self_update ON public.profiles;
CREATE TRIGGER trg_profiles_block_sensitive_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_block_sensitive_self_update();
