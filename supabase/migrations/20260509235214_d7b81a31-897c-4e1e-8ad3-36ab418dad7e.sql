
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_reactions_counter() SET search_path = public;
ALTER FUNCTION public.tg_comments_counter() SET search_path = public;
ALTER FUNCTION public.tg_credits_work_count() SET search_path = public;
ALTER FUNCTION public.tg_follows_counter() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Lock down SECURITY DEFINER helpers from direct API exposure
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
-- has_role still needs to be callable from authenticated session via RLS policies (which run as the policy owner), so leave authenticated grant intact for direct use by app if needed; explicit grant:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Replace overly-permissive instant_rooms insert policy with one that records auth.uid() existence check
DROP POLICY IF EXISTS "authed creates rooms" ON public.instant_rooms;
CREATE POLICY "authed creates rooms" ON public.instant_rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
