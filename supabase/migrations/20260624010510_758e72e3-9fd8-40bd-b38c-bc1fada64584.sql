
-- =========================================================
-- Issue #1: atomic deposit settlement (idempotent, race-safe)
-- =========================================================
CREATE OR REPLACE FUNCTION public.settle_deposit_atomic(
  _deposit_id uuid,
  _paid_sats bigint,
  _confirmations int,
  _next_status text,
  _delivery_id text,
  _webhook_id text,
  _event_type text,
  _invoice_id text,
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dep public.deposit_requests%ROWTYPE;
  v_delivery_inserted boolean := false;
  v_credited boolean := false;
BEGIN
  -- Idempotency: webhook_deliveries(source, delivery_id) is UNIQUE.
  -- A duplicate webhook short-circuits with replay=true and never re-credits.
  IF _delivery_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.webhook_deliveries(
        source, delivery_id, webhook_id, event_type, invoice_id, payload, result)
      VALUES ('btcpay', _delivery_id, _webhook_id, _event_type, _invoice_id, COALESCE(_payload,'{}'::jsonb), '{}'::jsonb);
      v_delivery_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('replay', true);
    END;
  END IF;

  -- Lock the deposit row for the duration of the transaction.
  SELECT * INTO v_dep FROM public.deposit_requests
    WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit_request % not found', _deposit_id; END IF;

  -- Always update confirmations/status (idempotent).
  UPDATE public.deposit_requests SET
    confirmations = COALESCE(_confirmations, confirmations),
    status = CASE
      WHEN _next_status = 'processing' THEN 'detected'
      WHEN _next_status = 'settled'    THEN 'settled'
      WHEN _next_status = 'expired'    THEN 'expired'
      WHEN _next_status = 'invalid'    THEN 'invalid'
      ELSE status
    END,
    detected_at = CASE
      WHEN _next_status = 'processing' AND detected_at IS NULL THEN now()
      ELSE detected_at END,
    settled_at = CASE
      WHEN _next_status = 'settled' AND settled_at IS NULL THEN now()
      ELSE settled_at END
  WHERE id = _deposit_id;

  -- Credit ONLY on the first settled transition.
  -- v_dep.status was captured BEFORE the update, so a replay where the row was
  -- already 'settled' skips the credit even if the row update is a no-op.
  IF _next_status = 'settled' AND v_dep.status <> 'settled' AND _paid_sats > 0 THEN
    PERFORM public.ledger_credit(
      v_dep.user_id, 'available'::ledger_bucket, _paid_sats,
      'deposit'::ledger_kind, 'deposit_request', _deposit_id,
      jsonb_build_object('method', v_dep.method, 'btcpay_invoice_id', _invoice_id));
    PERFORM public.wallet_audit(
      v_dep.user_id, 'deposit_settled', 'deposit_request', _deposit_id,
      NULL, NULL, 0,
      jsonb_build_object('amount_sats', _paid_sats, 'method', v_dep.method,
        'delivery_id', _delivery_id, 'invoice_id', _invoice_id));
    v_credited := true;
  END IF;

  IF v_delivery_inserted THEN
    UPDATE public.webhook_deliveries
      SET result = jsonb_build_object(
        'kind','wallet_deposit',
        'status', _next_status,
        'paid_sats', _paid_sats,
        'credited', v_credited)
      WHERE source='btcpay' AND delivery_id=_delivery_id;
  END IF;

  RETURN jsonb_build_object(
    'credited', v_credited,
    'paid_sats', _paid_sats,
    'status', _next_status);
END $$;

REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,bigint,int,text,text,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Issue #4: atomic escrow-invoice settlement (always ledgered)
-- =========================================================
CREATE OR REPLACE FUNCTION public.settle_escrow_invoice_atomic(
  _invoice_id uuid,
  _paid_sats bigint,
  _confirmations int,
  _paid_btc numeric,
  _next_status text,
  _delivery_id text,
  _webhook_id text,
  _event_type text,
  _btcpay_invoice_id text,
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.escrow_invoices%ROWTYPE;
  v_trade public.trades%ROWTYPE;
  v_delivery_inserted boolean := false;
  v_credited boolean := false;
BEGIN
  IF _delivery_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.webhook_deliveries(
        source, delivery_id, webhook_id, event_type, invoice_id, payload, result)
      VALUES ('btcpay', _delivery_id, _webhook_id, _event_type, _btcpay_invoice_id,
              COALESCE(_payload,'{}'::jsonb), '{}'::jsonb);
      v_delivery_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('replay', true);
    END;
  END IF;

  SELECT * INTO v_inv FROM public.escrow_invoices
    WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'escrow_invoice % not found', _invoice_id; END IF;

  UPDATE public.escrow_invoices SET
    confirmations  = COALESCE(_confirmations, confirmations),
    paid_amount_btc = COALESCE(_paid_btc, paid_amount_btc),
    status = COALESCE(NULLIF(_next_status, ''), status),
    settled_at = CASE
      WHEN _next_status = 'settled' AND settled_at IS NULL THEN now()
      ELSE settled_at END
  WHERE id = _invoice_id;

  -- On the first transition into 'settled', ALWAYS create a ledger entry,
  -- a wallet_audit row, and an escrow_events 'funded' record — regardless
  -- of the trade's current lifecycle state. This eliminates the class of
  -- bugs where funds settle on BTCPay but never appear in the ledger.
  IF _next_status = 'settled' AND v_inv.status <> 'settled' AND _paid_sats > 0 THEN
    SELECT * INTO v_trade FROM public.trades WHERE id = v_inv.trade_id;
    IF FOUND THEN
      PERFORM public.ledger_credit(
        v_trade.buyer_id, 'locked_escrow'::ledger_bucket, _paid_sats,
        'escrow_funding'::ledger_kind, 'escrow_invoice', _invoice_id,
        jsonb_build_object(
          'trade_id', v_trade.id,
          'btcpay_invoice_id', _btcpay_invoice_id,
          'source', 'onchain_funding'));
      PERFORM public.wallet_audit(
        v_trade.buyer_id, 'escrow_invoice_settled',
        'escrow_invoice', _invoice_id, NULL, NULL, 0,
        jsonb_build_object('amount_sats', _paid_sats,
                           'trade_id', v_trade.id,
                           'delivery_id', _delivery_id));
      INSERT INTO public.escrow_events(trade_id, invoice_id, kind, payload)
        VALUES (v_trade.id, _invoice_id, 'funded',
          jsonb_build_object('amount_sats', _paid_sats,
                             'btcpay_invoice_id', _btcpay_invoice_id));
      v_credited := true;
    END IF;
  END IF;

  IF v_delivery_inserted THEN
    UPDATE public.webhook_deliveries
      SET result = jsonb_build_object(
        'kind','escrow_invoice',
        'status', _next_status,
        'paid_sats', _paid_sats,
        'credited', v_credited)
      WHERE source='btcpay' AND delivery_id=_delivery_id;
  END IF;

  RETURN jsonb_build_object(
    'credited', v_credited,
    'paid_sats', _paid_sats,
    'status', _next_status);
END $$;

REVOKE EXECUTE ON FUNCTION public.settle_escrow_invoice_atomic(uuid,bigint,int,numeric,text,text,text,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;

-- =========================================================
-- Extend run_reconciliation: detect settled escrow invoices
-- with no ledger credit (Issue #4 historical guard).
-- =========================================================
CREATE OR REPLACE FUNCTION public.run_reconciliation()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_run_id uuid;
  v_drift int := 0;
  v_checks int := 0;
  r record;
BEGIN
  INSERT INTO public.reconciliation_runs(status) VALUES ('running') RETURNING id INTO v_run_id;

  FOR r IN
    SELECT wallet_id, user_id, available_sats, locked_escrow_sats, pending_deposit_sats, pending_withdrawal_sats
    FROM public.v_wallet_balances
    WHERE available_sats < 0 OR locked_escrow_sats < 0
       OR pending_deposit_sats < 0 OR pending_withdrawal_sats < 0
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

  FOR r IN
    SELECT d.id, d.user_id, d.amount_sats
    FROM public.deposit_requests d
    WHERE d.status = 'settled'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'deposit_request' AND le.ref_id = d.id
          AND le.kind = 'deposit' AND le.direction = 'credit')
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, actual_sats, details)
    VALUES (v_run_id, 'deposit_unsettled', 'critical', 'deposit_request', r.id,
      r.amount_sats, 0, jsonb_build_object('user_id', r.user_id));
  END LOOP;
  v_checks := v_checks + 1;

  FOR r IN
    SELECT t.id, t.buyer_id, t.seller_id, t.crypto_amount
    FROM public.trades t
    WHERE t.status = 'released'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'trade' AND le.ref_id = t.id
          AND le.kind = 'escrow_release' AND le.direction = 'debit'
          AND le.bucket = 'locked_escrow')
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, details)
    VALUES (v_run_id, 'release_missing', 'critical', 'trade', r.id,
      floor(r.crypto_amount * 100000000)::bigint,
      jsonb_build_object('buyer_id', r.buyer_id, 'seller_id', r.seller_id));
  END LOOP;
  v_checks := v_checks + 1;

  FOR r IN
    SELECT w.id, w.user_id, w.amount_sats
    FROM public.withdrawal_requests w
    WHERE w.status = 'sent'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'withdrawal_request' AND le.ref_id = w.id
          AND le.kind = 'withdrawal' AND le.direction = 'debit')
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, details)
    VALUES (v_run_id, 'withdrawal_not_debited', 'critical', 'withdrawal_request', r.id,
      r.amount_sats, jsonb_build_object('user_id', r.user_id));
  END LOOP;
  v_checks := v_checks + 1;

  -- NEW (Issue #4): settled escrow_invoices without a ledger credit.
  FOR r IN
    SELECT ei.id, ei.trade_id, ei.paid_amount_btc
    FROM public.escrow_invoices ei
    WHERE ei.status = 'settled'
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries le
        WHERE le.ref_type = 'escrow_invoice' AND le.ref_id = ei.id
          AND le.direction = 'credit' AND le.bucket = 'locked_escrow')
  LOOP
    v_drift := v_drift + 1;
    INSERT INTO public.reconciliation_drift(run_id, kind, severity, ref_type, ref_id, expected_sats, details)
    VALUES (v_run_id, 'escrow_invoice_unledgered', 'critical', 'escrow_invoice', r.id,
      floor(COALESCE(r.paid_amount_btc,0) * 100000000)::bigint,
      jsonb_build_object('trade_id', r.trade_id));
  END LOOP;
  v_checks := v_checks + 1;

  UPDATE public.reconciliation_runs
    SET finished_at = now(), checks_run = v_checks, drift_count = v_drift,
        status = CASE WHEN v_drift = 0 THEN 'ok' ELSE 'drift' END
    WHERE id = v_run_id;

  RETURN v_run_id;
END $$;

-- =========================================================
-- Issue #3: deprecate legacy escrow_groups at the DB layer.
-- Existing rows kept for audit; no new mutations allowed.
-- =========================================================
ALTER TABLE public.escrow_groups
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.tg_escrow_groups_deprecated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'escrow_groups is deprecated — use the ledger-backed escrow flow (offers/trades)';
  END IF;
  -- Allow status transitions only to terminal closed states so stuck rows
  -- can still be cleared by staff/admin tooling. Block everything else.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status IN ('cancelled','released','archived')
       AND OLD.status NOT IN ('cancelled','released','archived') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'escrow_groups is deprecated — read-only';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_escrow_groups_deprecated ON public.escrow_groups;
CREATE TRIGGER tg_escrow_groups_deprecated
  BEFORE INSERT OR UPDATE ON public.escrow_groups
  FOR EACH ROW EXECUTE FUNCTION public.tg_escrow_groups_deprecated();

CREATE OR REPLACE FUNCTION public.tg_escrow_group_members_deprecated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'escrow_group_members is deprecated';
END $$;

DROP TRIGGER IF EXISTS tg_escrow_group_members_deprecated ON public.escrow_group_members;
CREATE TRIGGER tg_escrow_group_members_deprecated
  BEFORE INSERT OR UPDATE OR DELETE ON public.escrow_group_members
  FOR EACH ROW EXECUTE FUNCTION public.tg_escrow_group_members_deprecated();

CREATE OR REPLACE FUNCTION public.tg_escrow_group_messages_deprecated()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'escrow_group_messages is deprecated';
END $$;

DROP TRIGGER IF EXISTS tg_escrow_group_messages_deprecated ON public.escrow_group_messages;
CREATE TRIGGER tg_escrow_group_messages_deprecated
  BEFORE INSERT OR UPDATE OR DELETE ON public.escrow_group_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_escrow_group_messages_deprecated();
