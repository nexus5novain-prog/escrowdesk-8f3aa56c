
-- Phase 3: Settings dashboard infrastructure
-- New tables: user_api_tokens, user_security_events, user_trusted_devices, user_withdrawal_policy
-- Plus extra profile fields for privacy/wallet preferences

-- 1) Profile extension fields (privacy, display, wallet prefs)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_trade_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_withdrawal_method text NOT NULL DEFAULT 'lightning' CHECK (default_withdrawal_method IN ('lightning','onchain')),
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

-- 2) API tokens for programmatic access
CREATE TABLE IF NOT EXISTS public.user_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  token_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_api_tokens TO authenticated;
GRANT ALL ON public.user_api_tokens TO service_role;
ALTER TABLE public.user_api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens read"   ON public.user_api_tokens FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own tokens insert" ON public.user_api_tokens FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own tokens update" ON public.user_api_tokens FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own tokens delete" ON public.user_api_tokens FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_user_api_tokens_user ON public.user_api_tokens(user_id, revoked_at);

-- 3) Security events (login, password change, withdrawal, suspicious activity)
CREATE TABLE IF NOT EXISTS public.user_security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,            -- 'login','logout','password_change','withdrawal_request','token_created','token_revoked','device_trusted','device_removed','settings_changed','suspicious'
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  ip text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_security_events TO authenticated;
GRANT ALL ON public.user_security_events TO service_role;
ALTER TABLE public.user_security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own security events read" ON public.user_security_events FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff read all security events" ON public.user_security_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_user_security_events_user_time ON public.user_security_events(user_id, created_at DESC);

-- 4) Trusted devices
CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  label text,
  user_agent text,
  ip text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  trusted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, device_fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_trusted_devices TO authenticated;
GRANT ALL ON public.user_trusted_devices TO service_role;
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices read"   ON public.user_trusted_devices FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own devices insert" ON public.user_trusted_devices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own devices update" ON public.user_trusted_devices FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own devices delete" ON public.user_trusted_devices FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 5) Per-user withdrawal policy / limits
CREATE TABLE IF NOT EXISTS public.user_withdrawal_policy (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  per_tx_limit_sats bigint NOT NULL DEFAULT 50000000,        -- 0.5 BTC
  daily_limit_sats  bigint NOT NULL DEFAULT 100000000,       -- 1 BTC
  require_2fa_above_sats bigint NOT NULL DEFAULT 10000000,   -- 0.1 BTC
  whitelist_only boolean NOT NULL DEFAULT false,
  whitelist_addresses text[] NOT NULL DEFAULT '{}',
  allowed_ip_cidrs text[] NOT NULL DEFAULT '{}',
  notify_email boolean NOT NULL DEFAULT true,
  notify_telegram boolean NOT NULL DEFAULT true,
  cooldown_hours int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_withdrawal_policy TO authenticated;
GRANT ALL ON public.user_withdrawal_policy TO service_role;
ALTER TABLE public.user_withdrawal_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own policy read"   ON public.user_withdrawal_policy FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own policy insert" ON public.user_withdrawal_policy FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own policy update" ON public.user_withdrawal_policy FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6) updated_at trigger fn (re-create if missing)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS tg_user_withdrawal_policy_touch ON public.user_withdrawal_policy;
CREATE TRIGGER tg_user_withdrawal_policy_touch BEFORE UPDATE ON public.user_withdrawal_policy
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7) Helper: log security event (SECURITY DEFINER so server fns can log for any context)
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id uuid, _kind text, _severity text DEFAULT 'info',
  _ip text DEFAULT NULL, _user_agent text DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.user_security_events(user_id, kind, severity, ip, user_agent, metadata)
  VALUES (_user_id, _kind, _severity, _ip, _user_agent, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
