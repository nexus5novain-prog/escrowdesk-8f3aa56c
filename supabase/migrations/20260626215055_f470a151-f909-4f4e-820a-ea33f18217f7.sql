-- 1) Revoke EXECUTE on all SECURITY DEFINER functions from anon/authenticated/PUBLIC.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name, r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_arbiter(uuid)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_case_party(uuid, uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid)       TO anon, authenticated;

-- 2) Scrub EXISTING listing descriptions first, while old trigger still tolerates them.
--    JSON descriptions: drop address keys, mask card_name.
UPDATE public.listings
SET description = (
  CASE
    WHEN (description::jsonb) ? 'card_name'
      AND jsonb_typeof((description::jsonb)->'card_name') = 'string'
    THEN jsonb_set(
      (description::jsonb)
        - 'card_address' - 'billing_address' - 'address' - 'address1'
        - 'address_line1' - 'address_line_1' - 'street' - 'street_address'
        - 'zip' - 'postal_code' - 'postcode',
      '{card_name}',
      to_jsonb(regexp_replace((description::jsonb)->>'card_name','^\s*(\S+)\s+(\S).*$','\1 \2.'))
    )
    ELSE (description::jsonb)
      - 'card_address' - 'billing_address' - 'address' - 'address1'
      - 'address_line1' - 'address_line_1' - 'street' - 'street_address'
      - 'zip' - 'postal_code' - 'postcode'
  END
)::text
WHERE description IS NOT NULL
  AND left(ltrim(description), 1) = '{'
  AND (
    description ILIKE '%card_address%'
    OR description ILIKE '%billing_address%'
    OR description ILIKE '%"address"%'
    OR description ILIKE '%postal_code%'
    OR description ILIKE '%"zip"%'
    OR description ILIKE '%street_address%'
    OR description ILIKE '%address_line%'
  );

-- Free-form: strip street-address fragments + US ZIPs.
UPDATE public.listings
SET description = regexp_replace(
  regexp_replace(
    description,
    '\m\d{1,6}\s+[A-Za-z][A-Za-z\.''\- ]{2,}\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Dr\.?|Hill|Court|Ct\.?|Boulevard|Blvd\.?|Way|Terrace|Place|Pl\.?)\M[^\n]*',
    '[address removed]',
    'gi'
  ),
  '\m[A-Z]{2}\s+\d{5}(-\d{4})?\M',
  '[zip removed]',
  'g'
)
WHERE description IS NOT NULL
  AND left(ltrim(description), 1) <> '{'
  AND (
    description ~* '\m\d{1,6}\s+[A-Za-z][A-Za-z\.''\- ]{2,}\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Dr\.?|Hill|Court|Ct\.?|Boulevard|Blvd\.?|Way|Terrace|Place|Pl\.?)\M'
    OR description ~ '\m[A-Z]{2}\s+\d{5}(-\d{4})?\M'
  );

-- 3) Replace trigger function with stricter address-stripping logic.
CREATE OR REPLACE FUNCTION public.tg_listings_block_pan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_text text;
  v_json jsonb;
  v_addr_keys text[] := ARRAY[
    'card_address','billing_address','address','address1','address_line1',
    'address_line_1','street','street_address','zip','postal_code','postcode'
  ];
  k text;
BEGIN
  IF NEW.description IS NULL THEN RETURN NEW; END IF;
  v_text := NEW.description;

  -- Reject standalone 13–19 digit runs (likely PAN).
  IF v_text ~ '\m\d{13,19}\M' THEN
    RAISE EXCEPTION 'Listing description must not contain card numbers';
  END IF;

  -- If JSON object, mask card_name and strip address-like keys.
  BEGIN
    v_json := NEW.description::jsonb;
  EXCEPTION WHEN others THEN
    v_json := NULL;
  END;

  IF v_json IS NOT NULL AND jsonb_typeof(v_json) = 'object' THEN
    IF v_json ? 'card_name' AND jsonb_typeof(v_json->'card_name') = 'string' THEN
      v_json := jsonb_set(
        v_json, '{card_name}',
        to_jsonb(regexp_replace(v_json->>'card_name','^\s*(\S+)\s+(\S).*$','\1 \2.')),
        false);
    END IF;
    FOREACH k IN ARRAY v_addr_keys LOOP
      IF v_json ? k THEN v_json := v_json - k; END IF;
    END LOOP;
    NEW.description := v_json::text;
    RETURN NEW;
  END IF;

  -- Free-form: reject street-address & postal-code patterns.
  IF v_text ~* '\m\d{1,6}\s+[A-Za-z][A-Za-z\.''\- ]{2,}\s+(Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Drive|Dr\.?|Hill|Court|Ct\.?|Boulevard|Blvd\.?|Way|Terrace|Place|Pl\.?)\M' THEN
    RAISE EXCEPTION 'Listing description must not contain a postal address';
  END IF;
  IF v_text ~ '\m[A-Z]{2}\s+\d{5}(-\d{4})?\M' THEN
    RAISE EXCEPTION 'Listing description must not contain a postal code';
  END IF;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_listings_block_pan ON public.listings;
CREATE TRIGGER tg_listings_block_pan
  BEFORE INSERT OR UPDATE OF description ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.tg_listings_block_pan();
