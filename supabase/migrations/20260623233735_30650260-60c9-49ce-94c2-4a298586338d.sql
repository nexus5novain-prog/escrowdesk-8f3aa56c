
-- Phase 2: Admin withdrawal approval infrastructure
-- Adds approvals join table, status-transition trigger, and admin RPCs.

-- 1. Approvals join table (immutable audit trail of every admin action)
CREATE TABLE public.withdrawal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawal_requests(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('approve','reject','mark_paid')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.withdrawal_approvals TO authenticated;
GRANT ALL ON public.withdrawal_approvals TO service_role;

ALTER TABLE public.withdrawal_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view all approvals" ON public.withdrawal_approvals
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "Users view own approvals" ON public.withdrawal_approvals
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.withdrawal_requests w
            WHERE w.id = withdrawal_id AND w.user_id = auth.uid())
  );

-- Immutable: no UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.tg_withdrawal_approvals_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'withdrawal_approvals is append-only'; END $$;

CREATE TRIGGER withdrawal_approvals_no_update
  BEFORE UPDATE OR DELETE ON public.withdrawal_approvals
  FOR EACH ROW EXECUTE FUNCTION public.tg_withdrawal_approvals_immutable();

CREATE INDEX idx_withdrawal_approvals_wid ON public.withdrawal_approvals(withdrawal_id);

-- 2. Status transition guard: nothing can move to 'sent' without at least one approve row;
--    >= $2000 USD equivalent (>= 2_000_000 sats at ~$1/sat sanity guard is wrong — we store usd in metadata)
--    so we use metadata.usd captured at request time.
CREATE OR REPLACE FUNCTION public.tg_withdrawal_status_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_approvals int;
  v_usd numeric;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Block direct user-side transitions to terminal admin states
  IF NEW.status IN ('approved','sent','rejected','failed','processing') THEN
    SELECT COUNT(*) INTO v_approvals FROM public.withdrawal_approvals
      WHERE withdrawal_id = NEW.id AND action = 'approve';
    v_usd := COALESCE((NEW.metadata->>'usd')::numeric, 0);

    IF NEW.status = 'sent' AND v_approvals < 1 THEN
      RAISE EXCEPTION 'Cannot mark paid without admin approval';
    END IF;
    IF v_usd >= 2000 AND NEW.status IN ('approved','sent') AND v_approvals < 2 THEN
      RAISE EXCEPTION 'Withdrawals >= $2000 require two admin approvals (have %)', v_approvals;
    END IF;
  END IF;

  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_withdrawal_status_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER withdrawal_status_guard
  BEFORE UPDATE OF status ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_withdrawal_status_guard();

-- 3. Admin RPCs
-- approve: records an approval row. Caller decides whether this is the 1st (single-admin)
--          or 2nd (dual-admin) approval; trigger enforces the threshold on the eventual
--          transition to 'sent'.
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(
  _withdrawal_id uuid, _admin uuid, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status withdrawal_status; v_usd numeric; v_count int;
BEGIN
  IF NOT public.is_staff(_admin) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status, COALESCE((metadata->>'usd')::numeric,0) INTO v_status, v_usd
    FROM public.withdrawal_requests WHERE id = _withdrawal_id FOR UPDATE;
  IF v_status NOT IN ('pending_review','approved') THEN
    RAISE EXCEPTION 'Cannot approve withdrawal in status %', v_status;
  END IF;
  -- prevent same admin approving twice
  IF EXISTS (SELECT 1 FROM public.withdrawal_approvals
             WHERE withdrawal_id=_withdrawal_id AND admin_id=_admin AND action='approve') THEN
    RAISE EXCEPTION 'Admin has already approved this withdrawal';
  END IF;

  INSERT INTO public.withdrawal_approvals(withdrawal_id, admin_id, action, note)
    VALUES (_withdrawal_id, _admin, 'approve', _note);

  SELECT COUNT(*) INTO v_count FROM public.withdrawal_approvals
    WHERE withdrawal_id=_withdrawal_id AND action='approve';

  -- Mark approved when threshold reached
  IF (v_usd < 2000 AND v_count >= 1) OR (v_usd >= 2000 AND v_count >= 2) THEN
    UPDATE public.withdrawal_requests
      SET status='approved', approved_by=_admin, approved_at=now(), updated_at=now()
      WHERE id=_withdrawal_id;
  END IF;

  PERFORM public.wallet_audit(
    (SELECT user_id FROM public.withdrawal_requests WHERE id=_withdrawal_id),
    'withdrawal_admin_approved', 'withdrawal_request', _withdrawal_id, NULL, NULL, 0,
    jsonb_build_object('admin_id', _admin, 'approvals', v_count, 'usd', v_usd));
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;

-- reject: refunds pending_withdrawal -> available, sets status='rejected'
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
    v.amount_sats, 'admin_adjustment'::ledger_kind, 'withdrawal_request', _withdrawal_id,
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

-- mark_paid: debits pending_withdrawal -> exits the system, stores tx_hash / payment_hash
CREATE OR REPLACE FUNCTION public.admin_mark_withdrawal_paid(
  _withdrawal_id uuid, _admin uuid, _tx_hash text DEFAULT NULL, _payment_hash text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v public.withdrawal_requests%ROWTYPE;
BEGIN
  IF NOT public.is_staff(_admin) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v FROM public.withdrawal_requests WHERE id=_withdrawal_id FOR UPDATE;
  IF v.status <> 'approved' THEN
    RAISE EXCEPTION 'Withdrawal must be approved before marking paid (current: %)', v.status;
  END IF;

  PERFORM public.ledger_debit(
    v.user_id, 'pending_withdrawal'::ledger_bucket, v.amount_sats,
    'withdrawal'::ledger_kind, 'withdrawal_request', _withdrawal_id,
    jsonb_build_object('admin', _admin, 'tx_hash', _tx_hash, 'payment_hash', _payment_hash));

  INSERT INTO public.withdrawal_approvals(withdrawal_id, admin_id, action, note)
    VALUES (_withdrawal_id, _admin, 'mark_paid', COALESCE(_tx_hash, _payment_hash));

  UPDATE public.withdrawal_requests
    SET status='sent', tx_hash=_tx_hash, payment_hash=_payment_hash, updated_at=now()
    WHERE id=_withdrawal_id;

  PERFORM public.wallet_audit(
    v.user_id, 'withdrawal_paid', 'withdrawal_request', _withdrawal_id, NULL, NULL, 0,
    jsonb_build_object('admin_id', _admin, 'tx_hash', _tx_hash, 'payment_hash', _payment_hash));
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_mark_withdrawal_paid(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
