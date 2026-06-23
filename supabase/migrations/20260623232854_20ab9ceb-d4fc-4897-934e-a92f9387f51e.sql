-- Revoke EXECUTE from PUBLIC on every privileged SECURITY DEFINER function
-- (only has_role / is_staff / is_arbiter / is_case_party / is_group_member stay public — they are used in RLS).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('has_role','is_staff','is_arbiter','is_case_party','is_group_member')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.proname, r.args);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO service_role;',                    r.proname, r.args);
  END LOOP;
END $$;
