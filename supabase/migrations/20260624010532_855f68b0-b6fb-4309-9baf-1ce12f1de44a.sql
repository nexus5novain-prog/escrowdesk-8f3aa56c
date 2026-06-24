
REVOKE EXECUTE ON FUNCTION public.run_reconciliation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_deposit_atomic(uuid,bigint,int,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.settle_escrow_invoice_atomic(uuid,bigint,int,numeric,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_escrow_groups_deprecated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_escrow_group_members_deprecated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_escrow_group_messages_deprecated() FROM PUBLIC, anon, authenticated;
