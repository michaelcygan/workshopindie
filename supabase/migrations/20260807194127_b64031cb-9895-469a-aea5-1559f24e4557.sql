-- Wave 13: reduce the reachable surface of SECURITY DEFINER routines.
--
-- Every function below already enforces its own rules internally; this removes
-- the ability for an un-entitled caller to invoke it at all, so a future bug in
-- one of those internal checks is not directly exposed to the internet.

-- 1. Trigger functions. These are invoked by Postgres on row changes and are
--    never meant to be called through the API by anyone.
REVOKE EXECUTE ON FUNCTION public.tg_blog_medium_groups() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_collab_medium_groups() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_event_medium_groups() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_group_members_optout() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_profiles_medium_groups() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_protect_system_groups() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_works_medium_groups() FROM anon, authenticated, PUBLIC;

-- 2. Routines that require a signed-in caller. They raise on a null auth.uid()
--    already, so removing anon EXECUTE changes no behaviour for real users.
REVOKE EXECUTE ON FUNCTION public.cast_workshop_poll_vote(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_lounge_screen_share(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_lounge_screen_share(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_lounge_screen_share(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_room_pin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_group_seed_link(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_link_workshop(uuid, text, uuid[]) FROM anon;

-- 3. Admin-only and scheduled maintenance routines.
REVOKE EXECUTE ON FUNCTION public.merge_city(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_city_status(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sweep_stale_lounge_speakers() FROM anon;

-- Intentionally left callable by signed-out visitors:
--   bump_work_view(uuid, text) - increments the view counter on public works.
--   check_and_bump(...)        - the rate limiter that guards anonymous paths.
--   is_*/has_* predicates      - read-only helpers used inside RLS policies.
