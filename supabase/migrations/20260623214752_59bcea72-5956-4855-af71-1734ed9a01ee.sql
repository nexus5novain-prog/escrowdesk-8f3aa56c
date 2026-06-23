ALTER TABLE public.link_previews
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS media_kind text;