CREATE TABLE public.shoutbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shoutbox_messages_created_at_idx ON public.shoutbox_messages (created_at DESC);

GRANT SELECT ON public.shoutbox_messages TO anon, authenticated;
GRANT INSERT, DELETE ON public.shoutbox_messages TO authenticated;
GRANT ALL ON public.shoutbox_messages TO service_role;

ALTER TABLE public.shoutbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shoutbox" ON public.shoutbox_messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can post" ON public.shoutbox_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.shoutbox_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.shoutbox_messages;