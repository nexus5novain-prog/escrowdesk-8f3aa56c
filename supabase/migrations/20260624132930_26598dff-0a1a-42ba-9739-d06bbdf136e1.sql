
-- 1. Fix mutable search_path on the IMMUTABLE helper
ALTER FUNCTION public.marketplace_products_fiat_currency_or_default(text) SET search_path = public;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from PUBLIC/anon/authenticated
--    Keep only RLS-helper functions executable.
DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    'has_role','is_staff','is_group_member','is_arbiter','is_case_party',
    'is_user_blocked','compute_fee_bps'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF r.proname = ANY(keep) THEN CONTINUE; END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 3. Tighten overly-permissive INSERT policies
DROP POLICY IF EXISTS "anyone can create a ticket" ON public.support_tickets;
CREATE POLICY "anyone can create a ticket" ON public.support_tickets
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND length(email)   <= 254
    AND length(subject) BETWEEN 1 AND 200
    AND length(message) BETWEEN 1 AND 5000
    AND (user_id IS NULL OR user_id = auth.uid())
    AND status = 'open'
    AND admin_response IS NULL
    AND responded_by IS NULL
    AND responded_at IS NULL
  );

DROP POLICY IF EXISTS "anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "anyone can subscribe" ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND length(email) <= 254
    AND (user_id IS NULL OR user_id = auth.uid())
    AND unsubscribed_at IS NULL
  );

-- 4. Drop sensitive card columns from marketplace_products
ALTER TABLE public.marketplace_products
  DROP COLUMN IF EXISTS card_number,
  DROP COLUMN IF EXISTS cvv,
  DROP COLUMN IF EXISTS expire_date,
  DROP COLUMN IF EXISTS card_address;

-- 5. Scrub any stored full PANs from listings.description and block future ones
UPDATE public.listings
  SET description = regexp_replace(description, '\m\d[ -]?(?:\d[ -]?){11,18}\d\M', '[redacted]', 'g')
  WHERE description ~ '\m\d[ -]?(?:\d[ -]?){11,18}\d\M';

CREATE OR REPLACE FUNCTION public.tg_listings_block_pan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.description ~ '\m\d[ -]?(?:\d[ -]?){11,18}\d\M' THEN
    RAISE EXCEPTION 'Listing description may not contain card numbers';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_listings_block_pan ON public.listings;
CREATE TRIGGER trg_listings_block_pan
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_listings_block_pan();
