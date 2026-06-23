
-- 1) profiles: column-level revoke for sensitive fields
REVOKE SELECT (telegram_user_id, telegram_username, ban_reason, banned_by, banned_at)
  ON public.profiles FROM anon, authenticated;

-- 2) arbitration-evidence: allow arbiters/admins to delete
DROP POLICY IF EXISTS "Arbitration evidence delete" ON storage.objects;
CREATE POLICY "Arbitration evidence delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'arbitration-evidence'
    AND (public.is_arbiter(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- 3) avatars: explicit public SELECT policy (bucket is intentionally public for avatars only)
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- 4) SECURITY DEFINER functions: revoke EXECUTE from PUBLIC/anon/authenticated
DO $$
DECLARE
  fn record;
  keep text[] := ARRAY[
    'has_role','is_staff','is_group_member','is_arbiter','is_case_party'
  ];
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      fn.nspname, fn.proname, fn.args
    );
    IF fn.proname = ANY(keep) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
        fn.nspname, fn.proname, fn.args
      );
    END IF;
  END LOOP;
END $$;
