
-- Suspension timestamp on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz;

-- Helper: is user banned or actively suspended right now
CREATE OR REPLACE FUNCTION public.is_user_blocked(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_banned OR (suspended_until IS NOT NULL AND suspended_until > now())
     FROM public.profiles WHERE user_id = _user),
    false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid) TO authenticated;

-- Replace listings INSERT policy to block banned/suspended users at the DB layer too
DROP POLICY IF EXISTS "Owner inserts own listing" ON public.listings;
CREATE POLICY "Owner inserts own listing"
  ON public.listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_user_blocked(auth.uid()));
