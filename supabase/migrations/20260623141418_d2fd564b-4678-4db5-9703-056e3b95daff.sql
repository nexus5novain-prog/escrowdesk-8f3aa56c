
-- 1. Shoutbox moderation columns
ALTER TABLE public.shoutbox_messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS btc_confirmations int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shouts_user_created ON public.shoutbox_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shouts_pinned ON public.shoutbox_messages(is_pinned DESC, created_at DESC) WHERE status='approved' AND is_hidden=false;
CREATE INDEX IF NOT EXISTS idx_shouts_pending_btc ON public.shoutbox_messages(status, payment_method) WHERE status='pending' AND payment_method='btc';

-- Update public select policy to exclude hidden
DROP POLICY IF EXISTS "Public can read approved shoutbox" ON public.shoutbox_messages;
CREATE POLICY "Public can read approved shoutbox" ON public.shoutbox_messages
  FOR SELECT USING (status = 'approved' AND is_hidden = false);

-- 2. Shoutbox reports
CREATE TABLE IF NOT EXISTS public.shoutbox_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.shoutbox_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, reporter_id)
);
GRANT SELECT, INSERT ON public.shoutbox_reports TO authenticated;
GRANT ALL ON public.shoutbox_reports TO service_role;
ALTER TABLE public.shoutbox_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own reports" ON public.shoutbox_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Staff read reports" ON public.shoutbox_reports
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_shout_report_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.shoutbox_messages
    SET report_count = (SELECT COUNT(*) FROM public.shoutbox_reports WHERE message_id = NEW.message_id)
    WHERE id = NEW.message_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_shout_report_count ON public.shoutbox_reports;
CREATE TRIGGER trg_shout_report_count AFTER INSERT ON public.shoutbox_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_shout_report_count();

-- 3. Ad events (impression + click tracking)
CREATE TABLE IF NOT EXISTS public.ad_events (
  id bigserial PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ad_banners(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  placement text NOT NULL,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.ad_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ad_events_id_seq TO anon, authenticated;
GRANT ALL ON public.ad_events TO service_role;
GRANT ALL ON SEQUENCE public.ad_events_id_seq TO service_role;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record ad events" ON public.ad_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff read ad events" ON public.ad_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ad_events_ad_kind ON public.ad_events(ad_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_events_placement ON public.ad_events(placement, kind, created_at DESC);

-- Helper rollup function for admin analytics
CREATE OR REPLACE FUNCTION public.ad_analytics(_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE(ad_id uuid, title text, placements text[], impressions bigint, clicks bigint, ctr numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT b.id, b.title, b.placements,
    COALESCE(SUM(CASE WHEN e.kind='impression' THEN 1 ELSE 0 END),0) AS impressions,
    COALESCE(SUM(CASE WHEN e.kind='click' THEN 1 ELSE 0 END),0) AS clicks,
    CASE WHEN SUM(CASE WHEN e.kind='impression' THEN 1 ELSE 0 END) > 0
      THEN ROUND(100.0 * SUM(CASE WHEN e.kind='click' THEN 1 ELSE 0 END)::numeric
        / SUM(CASE WHEN e.kind='impression' THEN 1 ELSE 0 END), 2)
      ELSE 0
    END AS ctr
  FROM public.ad_banners b
  LEFT JOIN public.ad_events e ON e.ad_id = b.id AND e.created_at >= _since
  GROUP BY b.id
  ORDER BY impressions DESC;
$$;

-- 4. Card style on listings + marketplace products
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS card_style smallint NOT NULL DEFAULT (floor(random()*8))::smallint;
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS card_style smallint NOT NULL DEFAULT (floor(random()*8))::smallint;
