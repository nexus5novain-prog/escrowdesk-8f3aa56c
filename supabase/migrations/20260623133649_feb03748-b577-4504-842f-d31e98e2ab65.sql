
DROP POLICY IF EXISTS "Read ads files" ON storage.objects;
CREATE POLICY "Read ads files" ON storage.objects
  FOR SELECT USING (bucket_id = 'ads');

DROP POLICY IF EXISTS "Staff manage ads files" ON storage.objects;
CREATE POLICY "Staff manage ads files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'ads' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)))
  WITH CHECK (bucket_id = 'ads' AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'moderator'::app_role)));
