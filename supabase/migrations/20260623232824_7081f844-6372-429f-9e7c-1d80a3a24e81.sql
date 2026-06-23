-- Lock down rebuilt SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.start_trade(uuid, uuid, numeric, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_trade(uuid, uuid)                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_trade(uuid, uuid)                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, uuid, text, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_platform_fees_immutable()                  FROM PUBLIC, anon, authenticated;

GRANT  EXECUTE ON FUNCTION public.start_trade(uuid, uuid, numeric, uuid)        TO service_role;
GRANT  EXECUTE ON FUNCTION public.release_trade(uuid, uuid)                     TO service_role;
GRANT  EXECUTE ON FUNCTION public.cancel_trade(uuid, uuid)                      TO service_role;
GRANT  EXECUTE ON FUNCTION public.resolve_dispute(uuid, uuid, text, text)       TO service_role;
GRANT  EXECUTE ON FUNCTION public.tg_platform_fees_immutable()                  TO service_role;
