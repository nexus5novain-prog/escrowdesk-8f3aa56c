
-- 1) escrow_groups: revoke direct SELECT on raw card credentials from anon/authenticated.
-- Server functions use the service role client and apply role-based masking before returning.
REVOKE SELECT (card_number, cvv, card_address, expire_date)
  ON public.escrow_groups FROM anon, authenticated;

-- 2) arbitration_audit_log: remove the user-writable INSERT policy.
-- All audit log writes must go through the service role (server functions / SECURITY DEFINER triggers).
DROP POLICY IF EXISTS "System append audit" ON public.arbitration_audit_log;
