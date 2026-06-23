
-- Fix search_path on immutability triggers
CREATE OR REPLACE FUNCTION public.tg_ledger_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END $$;

CREATE OR REPLACE FUNCTION public.tg_audit_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'wallet_audit_log is append-only';
END $$;

-- Hard-revoke EXECUTE from every non-service role on the new mutator fns
REVOKE EXECUTE ON FUNCTION public._ledger_insert(uuid,uuid,public.ledger_kind,public.ledger_direction,public.ledger_bucket,bigint,text,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._ledger_insert(uuid,uuid,public.ledger_kind,public.ledger_direction,public.ledger_bucket,bigint,text,uuid,jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ledger_credit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ledger_credit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ledger_debit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ledger_debit(uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ledger_transfer_bucket(uuid,public.ledger_bucket,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ledger_transfer_bucket(uuid,public.ledger_bucket,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.ledger_transfer_user(uuid,public.ledger_bucket,uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ledger_transfer_user(uuid,public.ledger_bucket,uuid,public.ledger_bucket,bigint,public.ledger_kind,text,uuid,jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.wallet_audit(uuid,text,text,uuid,inet,text,int,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_audit(uuid,text,text,uuid,inet,text,int,jsonb) FROM anon, authenticated;
