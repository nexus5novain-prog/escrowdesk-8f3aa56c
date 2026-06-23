
-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.ledger_kind AS ENUM (
    'deposit','withdrawal',
    'escrow_funding','escrow_release','refund',
    'marketplace_purchase','marketplace_sale',
    'fee','bonus','admin_adjustment',
    'bucket_transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_bucket AS ENUM (
    'available','locked_escrow','pending_deposit','pending_withdrawal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_direction AS ENUM ('credit','debit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deposit_method AS ENUM ('btc_onchain','lightning','flutterwave');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('new','detected','confirming','settled','expired','invalid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_method AS ENUM ('btc_onchain','lightning','flutterwave');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM (
    'pending_review','approved','rejected','processing','sent','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- user_wallets  (one per user, human-readable code)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.wallet_code_seq START 12345;

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_code text NOT NULL UNIQUE
              DEFAULT 'WAL-' || lpad(nextval('public.wallet_code_seq')::text, 8, '0'),
  is_frozen   boolean NOT NULL DEFAULT false,
  freeze_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.user_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view all wallets" ON public.user_wallets
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill wallets for existing users
INSERT INTO public.user_wallets (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Auto-create on new signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (user_id, asset) VALUES (NEW.id, 'BTC') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- ledger_entries  (append-only; the source of truth)
-- amounts in satoshis (BIGINT). 1 BTC = 100_000_000 sats.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     uuid NOT NULL REFERENCES public.user_wallets(id) ON DELETE RESTRICT,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind          public.ledger_kind NOT NULL,
  direction     public.ledger_direction NOT NULL,
  bucket        public.ledger_bucket NOT NULL,
  amount_sats   bigint NOT NULL CHECK (amount_sats > 0),
  ref_type      text,        -- 'trade','deposit_request','withdrawal_request','escrow_group','marketplace_order'
  ref_id        uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON public.ledger_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_bucket ON public.ledger_entries(wallet_id, bucket);
CREATE INDEX IF NOT EXISTS idx_ledger_ref ON public.ledger_entries(ref_type, ref_id);

-- GRANTs: users read only; only service_role writes
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger" ON public.ledger_entries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view all ledger" ON public.ledger_entries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
-- No INSERT/UPDATE/DELETE policies — writes only through SECURITY DEFINER fns

-- Immutability trigger: forbid UPDATE/DELETE even by service_role queries
CREATE OR REPLACE FUNCTION public.tg_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_ledger_no_update ON public.ledger_entries;
CREATE TRIGGER trg_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_ledger_immutable();

-- ============================================================
-- v_wallet_balances  (computed from ledger only)
-- ============================================================
CREATE OR REPLACE VIEW public.v_wallet_balances
WITH (security_invoker = on) AS
SELECT
  uw.id   AS wallet_id,
  uw.user_id,
  uw.wallet_code,
  COALESCE(SUM(CASE WHEN le.bucket='available'          AND le.direction='credit' THEN le.amount_sats
                    WHEN le.bucket='available'          AND le.direction='debit'  THEN -le.amount_sats END), 0)::bigint AS available_sats,
  COALESCE(SUM(CASE WHEN le.bucket='locked_escrow'      AND le.direction='credit' THEN le.amount_sats
                    WHEN le.bucket='locked_escrow'      AND le.direction='debit'  THEN -le.amount_sats END), 0)::bigint AS locked_escrow_sats,
  COALESCE(SUM(CASE WHEN le.bucket='pending_deposit'    AND le.direction='credit' THEN le.amount_sats
                    WHEN le.bucket='pending_deposit'    AND le.direction='debit'  THEN -le.amount_sats END), 0)::bigint AS pending_deposit_sats,
  COALESCE(SUM(CASE WHEN le.bucket='pending_withdrawal' AND le.direction='credit' THEN le.amount_sats
                    WHEN le.bucket='pending_withdrawal' AND le.direction='debit'  THEN -le.amount_sats END), 0)::bigint AS pending_withdrawal_sats
FROM public.user_wallets uw
LEFT JOIN public.ledger_entries le ON le.wallet_id = uw.id
GROUP BY uw.id, uw.user_id, uw.wallet_code;

GRANT SELECT ON public.v_wallet_balances TO authenticated, service_role;

-- ============================================================
-- deposit_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deposit_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id           uuid NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  method              public.deposit_method NOT NULL,
  status              public.deposit_status NOT NULL DEFAULT 'new',
  amount_sats         bigint,                      -- nullable for "any-amount" on-chain
  btcpay_invoice_id   text,
  destination         text NOT NULL,               -- BTC address or LN bolt11
  payment_hash        text,                        -- LN
  confirmations       int NOT NULL DEFAULT 0,
  confirmations_required int NOT NULL DEFAULT 1,
  detected_at         timestamptz,
  settled_at          timestamptz,
  expires_at          timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deposit_user_created ON public.deposit_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_invoice ON public.deposit_requests(btcpay_invoice_id);
CREATE INDEX IF NOT EXISTS idx_deposit_destination ON public.deposit_requests(destination);

GRANT SELECT ON public.deposit_requests TO authenticated;
GRANT ALL ON public.deposit_requests TO service_role;
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deposits" ON public.deposit_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view all deposits" ON public.deposit_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_deposit_requests_updated_at
  BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- withdrawal_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id           uuid NOT NULL REFERENCES public.user_wallets(id) ON DELETE CASCADE,
  method              public.withdrawal_method NOT NULL,
  status              public.withdrawal_status NOT NULL DEFAULT 'pending_review',
  amount_sats         bigint NOT NULL CHECK (amount_sats > 0),
  fee_sats            bigint NOT NULL DEFAULT 0,
  destination         text NOT NULL,               -- BTC addr / LN invoice / FLW payout ref
  risk_score          int NOT NULL DEFAULT 0,
  requires_2fa        boolean NOT NULL DEFAULT false,
  two_fa_verified_at  timestamptz,
  approved_by         uuid REFERENCES auth.users(id),
  approved_at         timestamptz,
  rejected_reason     text,
  tx_hash             text,                        -- BTC txid
  payment_hash        text,                        -- LN
  btcpay_payout_id    text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_created ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON public.withdrawal_requests(status);

GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view all withdrawals" ON public.withdrawal_requests
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER trg_withdrawal_requests_updated_at
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- wallet_audit_log (immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wallet_id   uuid REFERENCES public.user_wallets(id) ON DELETE SET NULL,
  action      text NOT NULL,
  ref_type    text,
  ref_id      uuid,
  ip          inet,
  user_agent  text,
  risk_score  int NOT NULL DEFAULT 0,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON public.wallet_audit_log(user_id, created_at DESC);

GRANT SELECT ON public.wallet_audit_log TO authenticated;
GRANT ALL ON public.wallet_audit_log TO service_role;
ALTER TABLE public.wallet_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit" ON public.wallet_audit_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff view all audit" ON public.wallet_audit_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_audit_log is append-only';
END $$;
DROP TRIGGER IF EXISTS trg_audit_no_update ON public.wallet_audit_log;
CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON public.wallet_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_immutable();

-- ============================================================
-- SECURITY DEFINER mutators
-- These are the ONLY way to mutate balances. Backend code (server fns
-- using service role, or webhooks) calls these.
-- ============================================================

-- Internal helper: insert a ledger entry, no overdraft check at insert level
-- (overdraft checks happen in higher-level fns below).
CREATE OR REPLACE FUNCTION public._ledger_insert(
  _wallet_id uuid, _user_id uuid,
  _kind public.ledger_kind, _direction public.ledger_direction,
  _bucket public.ledger_bucket, _amount_sats bigint,
  _ref_type text, _ref_id uuid, _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _amount_sats <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  INSERT INTO public.ledger_entries(wallet_id, user_id, kind, direction, bucket, amount_sats, ref_type, ref_id, metadata)
    VALUES (_wallet_id, _user_id, _kind, _direction, _bucket, _amount_sats, _ref_type, _ref_id, COALESCE(_metadata,'{}'::jsonb))
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public._ledger_insert(uuid,uuid,public.ledger_kind,public.ledger_direction,public.ledger_bucket,bigint,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Credit a bucket (e.g. user receives funds)
CREATE OR REPLACE FUNCTION public.ledger_credit(
  _user_id uuid, _bucket public.ledger_bucket, _amount_sats bigint,
  _kind public.ledger_kind, _ref_type text, _ref_id uuid, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid;
BEGIN
  SELECT id INTO v_wallet FROM public.user_wallets WHERE user_id = _user_id;
  IF v_wallet IS NULL THEN
    INSERT INTO public.user_wallets(user_id) VALUES (_user_id) RETURNING id INTO v_wallet;
  END IF;
  RETURN public._ledger_insert(v_wallet, _user_id, _kind, 'credit', _bucket, _amount_sats, _ref_type, _ref_id, _metadata);
END $$;
REVOKE EXECUTE ON FUNCTION public.ledger_credit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Debit a bucket (with overdraft protection)
CREATE OR REPLACE FUNCTION public.ledger_debit(
  _user_id uuid, _bucket public.ledger_bucket, _amount_sats bigint,
  _kind public.ledger_kind, _ref_type text, _ref_id uuid, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_balance bigint;
BEGIN
  SELECT id INTO v_wallet FROM public.user_wallets WHERE user_id = _user_id FOR UPDATE;
  IF v_wallet IS NULL THEN RAISE EXCEPTION 'No wallet'; END IF;

  SELECT CASE _bucket
    WHEN 'available'          THEN available_sats
    WHEN 'locked_escrow'      THEN locked_escrow_sats
    WHEN 'pending_deposit'    THEN pending_deposit_sats
    WHEN 'pending_withdrawal' THEN pending_withdrawal_sats
  END INTO v_balance FROM public.v_wallet_balances WHERE wallet_id = v_wallet;

  IF COALESCE(v_balance,0) < _amount_sats THEN
    RAISE EXCEPTION 'Insufficient % balance: have %, need %', _bucket, v_balance, _amount_sats;
  END IF;

  RETURN public._ledger_insert(v_wallet, _user_id, _kind, 'debit', _bucket, _amount_sats, _ref_type, _ref_id, _metadata);
END $$;
REVOKE EXECUTE ON FUNCTION public.ledger_debit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Move funds between buckets for the same user (e.g. available -> locked_escrow)
CREATE OR REPLACE FUNCTION public.ledger_transfer_bucket(
  _user_id uuid, _from public.ledger_bucket, _to public.ledger_bucket,
  _amount_sats bigint, _kind public.ledger_kind,
  _ref_type text, _ref_id uuid, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _from = _to THEN RAISE EXCEPTION 'from == to'; END IF;
  PERFORM public.ledger_debit (_user_id, _from, _amount_sats, _kind, _ref_type, _ref_id, _metadata);
  PERFORM public.ledger_credit(_user_id, _to,   _amount_sats, _kind, _ref_type, _ref_id, _metadata);
END $$;
REVOKE EXECUTE ON FUNCTION public.ledger_transfer_bucket(uuid,public.ledger_bucket,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Transfer between users (e.g. escrow release: buyer locked -> seller available)
CREATE OR REPLACE FUNCTION public.ledger_transfer_user(
  _from_user uuid, _from_bucket public.ledger_bucket,
  _to_user uuid,   _to_bucket public.ledger_bucket,
  _amount_sats bigint, _kind public.ledger_kind,
  _ref_type text, _ref_id uuid, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ledger_debit (_from_user, _from_bucket, _amount_sats, _kind, _ref_type, _ref_id, _metadata);
  PERFORM public.ledger_credit(_to_user,   _to_bucket,   _amount_sats, _kind, _ref_type, _ref_id, _metadata);
END $$;
REVOKE EXECUTE ON FUNCTION public.ledger_transfer_user(uuid,public.ledger_bucket,uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Convenience: write to audit log
CREATE OR REPLACE FUNCTION public.wallet_audit(
  _user_id uuid, _action text, _ref_type text DEFAULT NULL, _ref_id uuid DEFAULT NULL,
  _ip inet DEFAULT NULL, _user_agent text DEFAULT NULL,
  _risk_score int DEFAULT 0, _payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_id uuid;
BEGIN
  SELECT id INTO v_wallet FROM public.user_wallets WHERE user_id = _user_id;
  INSERT INTO public.wallet_audit_log(user_id, wallet_id, action, ref_type, ref_id, ip, user_agent, risk_score, payload)
    VALUES (_user_id, v_wallet, _action, _ref_type, _ref_id, _ip, _user_agent, _risk_score, COALESCE(_payload,'{}'::jsonb))
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.wallet_audit(uuid,text,text,uuid,inet,text,int,jsonb) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Realtime
-- ============================================================
ALTER TABLE public.ledger_entries       REPLICA IDENTITY FULL;
ALTER TABLE public.deposit_requests     REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawal_requests  REPLICA IDENTITY FULL;
ALTER TABLE public.user_wallets         REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_entries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
