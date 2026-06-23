
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_shout_report_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_trade_ratings_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_user_roles_recompute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- has_role / is_staff / is_group_member intentionally remain executable: they are referenced inside RLS policy expressions.
