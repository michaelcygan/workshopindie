-- Align active Lounge discovery with the more forgiving presence window and tighten touched function permissions.

CREATE OR REPLACE FUNCTION public.list_active_instant_rooms(_viewer uuid)
 RETURNS TABLE(id uuid, medium category, title text, live_count integer, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _live_cutoff timestamptz := now() - interval '5 minutes';
BEGIN
  RETURN QUERY
  SELECT r.id, r.medium, r.title,
         COALESCE((SELECT count(*)::int FROM public.instant_presence p
                   WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff), 0) AS live_count,
         r.created_at
    FROM public.instant_rooms r
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(r.locked, false) = false
     AND (
       r.group_id IS NULL
       OR (_viewer IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = r.group_id AND gm.user_id = _viewer
       ))
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id
          AND p.last_seen_at > _live_cutoff
          AND _viewer IS NOT NULL
          AND public.is_blocked_pair(_viewer, p.user_id)
     )
   ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_lounge(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_medium_lounge(uuid, category, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_group_lounge(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_active_instant_rooms(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_stale_lounges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_instant_presence_archive_empty() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_lounge(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_medium_lounge(uuid, category, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_group_lounge(uuid, uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_active_instant_rooms(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sweep_stale_lounges() TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_instant_presence_archive_empty() TO service_role;