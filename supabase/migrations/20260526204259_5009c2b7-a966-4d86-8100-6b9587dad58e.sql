
REVOKE EXECUTE ON FUNCTION public.user_age(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_min_age(uuid, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_max_age(uuid, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_age(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_min_age(uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_max_age(uuid, int) TO authenticated, service_role;
