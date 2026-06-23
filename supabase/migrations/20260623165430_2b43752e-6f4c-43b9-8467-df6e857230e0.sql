ALTER TABLE public.ad_banners ADD COLUMN IF NOT EXISTS cta_label TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'ad_events' AND constraint_name = 'ad_events_kind_check'
  ) THEN
    ALTER TABLE public.ad_events DROP CONSTRAINT ad_events_kind_check;
  END IF;
END $$;

ALTER TABLE public.ad_events
  ADD CONSTRAINT ad_events_kind_check
  CHECK (kind IN ('impression', 'click', 'error'));