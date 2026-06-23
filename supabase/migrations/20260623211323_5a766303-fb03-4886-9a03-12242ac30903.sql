
-- Notification kinds
DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'escrow_invoice_created','escrow_payment_detected','escrow_settled','escrow_expired',
    'trade_signed','trade_paid','trade_released','trade_cancelled',
    'dispute_opened','dispute_resolved','arbitration_update',
    'wallet_credit','wallet_debit','admin_warning','admin_ban','system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind public.notification_kind NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own notifications read" ON public.notifications;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own notifications update" ON public.notifications;
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL,
  kind public.notification_kind NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  telegram boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own prefs all" ON public.notification_preferences;
CREATE POLICY "own prefs all" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Link previews cache
CREATE TABLE IF NOT EXISTS public.link_previews (
  url text PRIMARY KEY,
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.link_previews TO authenticated, anon;
GRANT ALL ON public.link_previews TO service_role;
ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "previews public read" ON public.link_previews;
CREATE POLICY "previews public read" ON public.link_previews FOR SELECT TO anon, authenticated USING (true);

-- Ad sizing
ALTER TABLE public.ad_banners
  ADD COLUMN IF NOT EXISTS size_preset text,
  ADD COLUMN IF NOT EXISTS width int,
  ADD COLUMN IF NOT EXISTS height int;

-- Helper: notify_user (insert in-app + return id; Telegram dispatch handled server-side using payload)
CREATE OR REPLACE FUNCTION public.notify_user(
  _user uuid, _kind public.notification_kind, _title text,
  _body text DEFAULT NULL, _link text DEFAULT NULL, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_in_app boolean;
BEGIN
  SELECT COALESCE(in_app, true) INTO v_in_app FROM notification_preferences WHERE user_id=_user AND kind=_kind;
  IF v_in_app IS NULL THEN v_in_app := true; END IF;
  IF v_in_app THEN
    INSERT INTO notifications(user_id, kind, title, body, link, payload)
      VALUES (_user, _kind, _title, _body, _link, COALESCE(_payload,'{}'::jsonb))
      RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_kind, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
