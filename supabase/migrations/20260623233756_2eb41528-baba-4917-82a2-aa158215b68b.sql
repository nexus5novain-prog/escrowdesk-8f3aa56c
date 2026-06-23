
-- Defensively revoke EXECUTE on all Phase 2 SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.tg_withdrawal_status_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_approve_withdrawal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_mark_withdrawal_paid(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
