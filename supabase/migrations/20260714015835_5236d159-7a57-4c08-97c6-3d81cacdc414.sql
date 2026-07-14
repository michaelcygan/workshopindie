-- Revoke EXECUTE on internal/administrative SECURITY DEFINER functions from
-- client roles. These are trigger, cron, realtime-auth, or admin helpers and
-- should never be callable directly by anon/authenticated clients.

REVOKE EXECUTE ON FUNCTION public.admin_log(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_promo_pass(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_lounges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_work_vouches_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.realtime_can_access_dm(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realtime_can_access_instant_room(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realtime_can_access_persona(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realtime_can_access_workshop(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realtime_can_access_workshop_host(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.realtime_topic_allowed(text) FROM PUBLIC, anon;
