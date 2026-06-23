
ALTER TABLE public.shoutbox_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('wallet','btc')),
  ADD COLUMN IF NOT EXISTS payment_txid text,
  ADD COLUMN IF NOT EXISTS paid_amount_usd numeric(12,2),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

UPDATE public.shoutbox_messages SET status = 'approved' WHERE status = 'pending' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS shoutbox_messages_status_idx ON public.shoutbox_messages (status, created_at DESC);

DROP POLICY IF EXISTS "Anyone can read shoutbox" ON public.shoutbox_messages;
DROP POLICY IF EXISTS "Public can read approved shoutbox" ON public.shoutbox_messages;
DROP POLICY IF EXISTS "Authors and staff can read all shoutbox" ON public.shoutbox_messages;
CREATE POLICY "Public can read approved shoutbox" ON public.shoutbox_messages
  FOR SELECT USING (status = 'approved');
CREATE POLICY "Authors and staff can read all shoutbox" ON public.shoutbox_messages
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated users can post" ON public.shoutbox_messages;

DROP POLICY IF EXISTS "Staff can update shoutbox" ON public.shoutbox_messages;
CREATE POLICY "Staff can update shoutbox" ON public.shoutbox_messages
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  ) WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

INSERT INTO public.platform_settings(key, value)
  VALUES ('shoutbox_btc_address', '""'::jsonb)
  ON CONFLICT (key) DO NOTHING;
INSERT INTO public.platform_settings(key, value)
  VALUES ('shoutbox_fee_usd', '5'::jsonb)
  ON CONFLICT (key) DO NOTHING;
