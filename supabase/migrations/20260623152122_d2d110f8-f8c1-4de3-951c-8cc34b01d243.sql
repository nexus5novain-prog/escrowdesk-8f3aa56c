
-- Path convention: <case_id>/<filename>
CREATE POLICY "Arbitration evidence read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'arbitration-evidence'
    AND (
      public.is_arbiter(auth.uid())
      OR public.is_case_party((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

CREATE POLICY "Arbitration evidence upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'arbitration-evidence'
    AND owner = auth.uid()
    AND (
      public.is_arbiter(auth.uid())
      OR public.is_case_party((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );
