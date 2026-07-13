-- 1) New matchmaker RPC for group-scoped Lounges.
CREATE OR REPLACE FUNCTION public.join_group_lounge(
  _user_id uuid,
  _group_id uuid,
  _exclude_room_ids uuid[] DEFAULT '{}'
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '5 minutes';
  _live_cutoff  timestamptz := now() - interval '60 seconds';
  _cap int := 5;
  _group_name text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _group_id IS NULL THEN RAISE EXCEPTION 'group required'; END IF;

  -- Archive stale empty rooms for this group.
  UPDATE public.instant_rooms r
     SET status = 'archived'
   WHERE r.kind = 'lounge'
     AND r.group_id = _group_id
     AND r.status = 'active'
     AND r.created_at < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _stale_cutoff
     );

  -- Prefer an active group room with a seat; matchmaker ordering matches join_lounge.
  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.group_id = _group_id
     AND COALESCE(r.visibility, 'open') = 'open'
     AND COALESCE(r.locked, false) = false
     AND COALESCE(lc.live_count, 0) < _cap
     AND NOT (r.id = ANY(COALESCE(_exclude_room_ids, '{}'::uuid[])))
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_room_removals rm
        WHERE rm.room_id = r.id AND rm.user_id = _user_id AND rm.until > now()
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id
          AND p.last_seen_at > _live_cutoff
          AND public.is_blocked_pair(_user_id, p.user_id)
     )
   ORDER BY
     (r.host_user_id IS NOT NULL AND public.is_follow(_user_id, r.host_user_id)) DESC,
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    SELECT name INTO _group_name FROM public.groups WHERE id = _group_id;
    INSERT INTO public.instant_rooms (kind, title, status, participant_cap, creator_id, host_user_id, group_id, visibility)
    VALUES ('lounge', COALESCE(_group_name, 'Group') || ' · Lounge', 'active', _cap, _user_id, NULL, _group_id, 'open')
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_group_lounge(uuid, uuid, uuid[]) TO authenticated;

-- 2) list_active_instant_rooms: surface group-scoped rooms to members only.
CREATE OR REPLACE FUNCTION public.list_active_instant_rooms(_viewer uuid)
 RETURNS TABLE(id uuid, medium category, title text, live_count integer, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _live_cutoff timestamptz := now() - interval '60 seconds';
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

GRANT EXECUTE ON FUNCTION public.list_active_instant_rooms(uuid) TO authenticated;