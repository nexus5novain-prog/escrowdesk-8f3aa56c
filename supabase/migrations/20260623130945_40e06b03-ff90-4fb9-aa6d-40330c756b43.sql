ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER TABLE public.listings REPLICA IDENTITY FULL;