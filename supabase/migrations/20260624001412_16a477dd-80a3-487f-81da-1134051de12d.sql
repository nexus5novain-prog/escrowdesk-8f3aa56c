
-- Phase 4: Wallet hardening — webhook idempotency + reconciliation

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  delivery_id text NOT NULL,
  webhook_id text,
  event_type text,
  invoice_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  result jsonb,
  UNIQUE (source, delivery_id)
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_webhook_deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Immutable
CREATE OR REPLACE FUNCTION public.tg_webhook_deliveries_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'webhook_deliveries is append-only'; END $$;
CREATE TRIGGER webhook_deliveries_no_update BEFORE UPDATE OR DELETE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.tg_webhook_deliveries_immutable();

CREATE INDEX idx_webhook_deliveries_invoice ON public.webhook_deliveries(invoice_id);
CREATE INDEX idx_webhook_deliveries_processed ON public.webhook_deliveries(processed_at DESC);

-- Reconciliation drift log
CREATE TABLE public.reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',  -- running | ok | drift | failed
  checks_run int NOT NULL DEFAULT 0,
  drift_count int NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.reconciliation_runs TO authenticated;
GRANT ALL ON public.reconciliation_runs TO service_role;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_recon_runs" ON public.reconciliation_runs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE TABLE public.reconciliation_drift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,                  -- e.g. 'deposit_unsettled', 'invoice_orphan', 'bucket_negative'
  severity text NOT NULL DEFAULT 'warning', -- info | warning | critical
  ref_type text,
  ref_id uuid,
  expected_sats bigint,
  actual_sats bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);
GRANT SELECT ON public.reconciliation_drift TO authenticated;
GRANT ALL ON public.reconciliation_drift TO service_role;
ALTER TABLE public.reconciliation_drift ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_recon_drift" ON public.reconciliation_drift
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff_resolve_recon_drift" ON public.reconciliation_drift
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE INDEX idx_recon_drift_run ON public.reconciliation_drift(run_id);
CREATE INDEX idx_recon_drift_unresolved ON public.reconciliation_drift(resolved_at) WHERE resolved_at IS NULL;

-- Run reconciliation: compares user_wallets balances to ledger sums (drift detection).
CREATE OR REPLACE FUNCTION public.run_reconciliation()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run_id uuid;
  v_drift int := 0;
  v_checks int := 0;
  r record;
BEGIN
  INSERT INTO public.reconciliation_runs(status) VALUES ('running') RETURNING id INTO v_run_id;

  -- Check 1: negative balances in any bucket
  FOR r IN
    SELECT wallet_id, user_id, available_sats, locked_escrow_sats, pending_deposit_sats, pending_withdrawal_sats
    FROM public.v_wallet_balances
    WHERE available_sats < 0 OR locked_escrow_sats < 0 OR pending_deposit_sats < 0 OR pending_withdrawal_sats < 0
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, actual_sats, details)
    VALUES (v_run_id, 'bucket_negative', 'critical', 'user_wallet', r.wallet_id,
      LEAST(r.available_sats, r.locked_escrow_sats, r.pending_deposit_sats, r.pending_withdrawal_sats),
      jsonb_build_object('user_id', r.user_id,
        'available_sats', r.available_sats, 'locked_escrow_sats', r.locked_escrow_sats,
        'pending_deposit_sats', r.pending_deposit_sats, 'pending_withdrawal_sats', r.pending_withdrawal_sats));
  END LOOP;
  v_checks := v_checks + 1;

  -- Check 2: settled deposits without a matching deposit ledger credit
  FOR r IN
    SELECT d.id, d.user_id, d.amount_sats
    FROM public.deposit_requests d
    WHERE d.status = 'settled'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'deposit_request' AND le.ref_id = d.id
          AND le.kind = 'deposit' AND le.direction = 'credit'
      )
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, actual_sats, details)
    VALUES (v_run_id, 'deposit_unsettled', 'critical', 'deposit_request', r.id,
      r.amount_sats, 0, jsonb_build_object('user_id', r.user_id));
  END LOOP;
  v_checks := v_checks + 1;

  -- Check 3: released trades whose locked_escrow was never released
  FOR r IN
    SELECT t.id, t.buyer_id, t.seller_id, t.crypto_amount
    FROM public.trades t
    WHERE t.status = 'released'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'trade' AND le.ref_id = t.id
          AND le.kind = 'escrow_release' AND le.direction = 'debit'
          AND le.bucket = 'locked_escrow'
      )
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, details)
    VALUES (v_run_id, 'release_missing', 'critical', 'trade', r.id,
      floor(r.crypto_amount * 100000000)::bigint,
      jsonb_build_object('buyer_id', r.buyer_id, 'seller_id', r.seller_id));
  END LOOP;
  v_checks := v_checks + 1;

  -- Check 4: sent withdrawals without a debit ledger entry
  FOR r IN
    SELECT w.id, w.user_id, w.amount_sats
    FROM public.withdrawal_requests w
    WHERE w.status = 'sent'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'withdrawal_request' AND le.ref_id = w.id
          AND le.kind = 'withdrawal' AND le.direction = 'debit'
      )
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, details)
    VALUES (v_run_id, 'withdrawal_not_debited', 'critical', 'withdrawal_request', r.id,
      r.amount_sats, jsonb_build_object('user_id', r.user_id));
  END LOOP;
  v_checks := v_checks + 1;

  UPDATE public.reconciliation_runs
    SET finished_at = now(), checks_run = v_checks, drift_count = v_drift,
        status = CASE WHEN v_drift = 0 THEN 'ok' ELSE 'drift' END
    WHERE id = v_run_id;

  RETURN v_run_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_reconciliation() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_drift(_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.reconciliation_drift
    SET resolved_at = now(), resolution_note = _note
    WHERE id = _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_drift(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_drift(uuid, text) TO authenticated;
