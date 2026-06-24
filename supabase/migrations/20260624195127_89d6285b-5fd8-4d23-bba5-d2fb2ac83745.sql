
-- 1) ad_events: tie inserts to the authenticated user
DROP POLICY IF EXISTS "Authenticated users record ad events" ON public.ad_events;
CREATE POLICY "Authenticated users record own ad events"
  ON public.ad_events FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- 2) listings description sanitisation: also scrub cardholder name + address
CREATE OR REPLACE FUNCTION public.tg_listings_block_pan()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NEW.description IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reject raw card numbers anywhere in the text.
  IF NEW.description ~ '\m\d[ -]?(?:\d[ -]?){11,18}\d\M' THEN
    RAISE EXCEPTION 'Listing description may not contain card numbers';
  END IF;

  -- If the description is structured JSON, strip / mask sensitive cardholder fields.
  BEGIN
    v := NEW.description::jsonb;
  EXCEPTION WHEN others THEN
    v := NULL;
  END;

  IF v IS NOT NULL AND jsonb_typeof(v) = 'object' THEN
    -- card_name → first name + last-initial only (e.g. "MOULIN CYRIL" → "Cyril M.")
    IF v ? 'card_name' AND jsonb_typeof(v->'card_name') = 'string' THEN
      DECLARE
        raw text := btrim(v->>'card_name');
        parts text[];
        masked text;
      BEGIN
        IF raw = '' THEN
          v := v - 'card_name';
        ELSE
          parts := regexp_split_to_array(raw, '\s+');
          IF array_length(parts, 1) >= 2 THEN
            masked := initcap(parts[1]) || ' ' || upper(left(parts[array_length(parts,1)], 1)) || '.';
          ELSE
            masked := initcap(parts[1]);
          END IF;
          v := jsonb_set(v, '{card_name}', to_jsonb(masked));
        END IF;
      END;
    END IF;

    -- card_address: never store
    v := v - 'card_address';
    -- belt-and-braces: drop other obvious PII keys
    v := v - 'cardholder_address' - 'billing_address' - 'address' - 'card_zip' - 'zip' - 'postal_code';

    NEW.description := v::text;
  END IF;

  RETURN NEW;
END $function$;

-- 3) profiles: lock raw table to owner+staff, expose safe columns via a view
DROP POLICY IF EXISTS "Public profile fields readable" ON public.profiles;
CREATE POLICY "Owners and staff read profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  user_id, display_name, avatar_url, bio,
  trades_completed, rating_sum, rating_count,
  is_premium, is_trusted,
  btc_volume_usd, distinct_partners, five_star_count,
  show_trade_history, show_online_status,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 4) Lock down SECURITY DEFINER functions: revoke broad EXECUTE, keep only RLS helpers callable.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE only on the helpers RLS / triggers / WITH CHECK clauses depend on.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_arbiter(uuid)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_party(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid)    TO anon, authenticated;
