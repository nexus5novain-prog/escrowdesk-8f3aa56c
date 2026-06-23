
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
