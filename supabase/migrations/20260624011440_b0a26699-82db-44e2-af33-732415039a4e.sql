-- ==========================================================
-- Phase 2 hardening: #2 Lightning payment_hash + #8 ledger event
-- ==========================================================

-- #8: dedicated 'withdrawal_cancelled' ledger kind for accurate audit history
ALTER TYPE public.ledger_kind ADD VALUE IF NOT EXISTS 'withdrawal_cancelled';

-- Commit the new enum value so subsequent statements in this transaction can use it
COMMIT;
BEGIN;

-- Update admin_reject_withdrawal to use the dedicated kind
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
  _withdrawal_id uuid, _admin uuid, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_staff(_admin) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v FROM public.withdrawal_requests WHERE id=_withdrawal_id FOR UPDATE;
  IF v.status NOT IN ('pending_review','approved') THEN
    RAISE EXCEPTION 'Cannot reject withdrawal in status %', v.status;
  END IF;

  PERFORM public.ledger_transfer_bucket(
    v.user_id, 'pending_withdrawal'::ledger_bucket, 'available'::ledger_bucket,
    v.amount_sats, 'withdrawal_cancelled'::ledger_kind, 'withdrawal_request', _withdrawal_id,
    jsonb_build_object('reason','admin_rejected', 'admin', _admin));

  INSERT INTO public.withdrawal_approvals(withdrawal_id, admin_id, action, note)
    VALUES (_withdrawal_id, _admin, 'reject', _reason);

  UPDATE public.withdrawal_requests
    SET status='rejected', rejected_reason=_reason, updated_at=now()
    WHERE id=_withdrawal_id;

  PERFORM public.wallet_audit(
    v.user_id, 'withdrawal_rejected', 'withdrawal_request', _withdrawal_id, NULL, NULL, 0,
    jsonb_build_object('admin_id', _admin, 'reason', _reason));
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;

-- #2: capture Lightning payment_hash on deposit settlement
CREATE OR REPLACE FUNCTION public.settle_deposit_atomic(
  _deposit_id uuid,
  _paid_sats bigint,
  _confirmations int,
  _next_status text,
  _delivery_id text,
  _webhook_id text,
  _event_type text,
  _invoice_id text,
  _payload jsonb,
  _payment_hash text DEFAULT NULL
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

  SELECT * INTO v_dep FROM public.deposit_requests
    WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deposit_request % not found', _deposit_id; END IF;

  UPDATE public.deposit_requests SET
    confirmations = COALESCE(_confirmations, confirmations),
    payment_hash = COALESCE(payment_hash, _payment_hash),
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

  IF _next_status = 'settled' AND v_dep.status <> 'settled' AND _paid_sats > 0 THEN
    PERFORM public.ledger_credit(
      v_dep.user_id, 'available'::ledger_bucket, _paid_sats,
      'deposit'::ledger_kind, 'deposit_request', _deposit_id,
      jsonb_build_object(
        'method', v_dep.method,
        'btcpay_invoice_id', _invoice_id,
        'payment_hash', _payment_hash));
    PERFORM public.wallet_audit(
      v_dep.user_id, 'deposit_settled', 'deposit_request', _deposit_id,
      NULL, NULL, 0,
      jsonb_build_object('amount_sats', _paid_sats, 'method', v_dep.method,
        'delivery_id', _delivery_id, 'invoice_id', _invoice_id,
        'payment_hash', _payment_hash));
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

REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,bigint,int,text,text,text,text,text,jsonb,text)
  FROM PUBLIC, anon, authenticated;