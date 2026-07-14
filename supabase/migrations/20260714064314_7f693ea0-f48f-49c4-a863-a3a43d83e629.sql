
-- Lounge lifecycle: short end-timer + hide dying rooms from matchmaker/discovery.

-- 1) Sweep: 45s grace after emptied_at, cron already runs every minute.
CREATE OR REPLACE FUNCTION public.sweep_stale_lounges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live_cutoff timestamptz := now() - interval '5 minutes';
  _grace_cutoff timestamptz := now() - interval '45 seconds';
  _delete_cutoff timestamptz := now() - interval '24 hours';
BEGIN
  -- Someone rejoined during grace: clear the emptied stamp.
  UPDATE public.instant_rooms r
     SET emptied_at = NULL
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  -- No live presence and never stamped: stamp now (heartbeat-drop case).
  UPDATE public.instant_rooms r
     SET emptied_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  -- Grace expired: archive.
  UPDATE public.instant_rooms r
     SET status = 'archived',
         closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND r.emptied_at < _grace_cutoff;

  -- Old archived rooms: hard-delete after 24h.
  DELETE FROM public.instant_rooms r
   WHERE r.kind = 'lounge'
     AND r.status = 'archived'
     AND r.closed_at IS NOT NULL
     AND r.closed_at < _delete_cutoff;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_stale_lounges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_lounges() TO service_role;

-- 2) join_lounge: 45s stale cutoff, exclude rooms with emptied_at set,
--    drop the "has-anyone" first sort key.
CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid, _exclude_room_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '45 seconds';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _cap int := 5;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived', closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.medium IS NULL
     AND r.group_id IS NULL
     AND r.status = 'active'
     AND COALESCE(r.emptied_at, r.created_at) < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.medium IS NULL
     AND r.group_id IS NULL
     AND r.emptied_at IS NULL
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
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', 'Artist''s Lounge', NULL, 'active', _cap, _user_id, NULL)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- 3) join_medium_lounge: same treatment.
CREATE OR REPLACE FUNCTION public.join_medium_lounge(_user_id uuid, _medium category, _exclude_room_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '45 seconds';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _cap int := 5;
  _title text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user required';
  END IF;
  IF _medium IS NULL THEN
    RAISE EXCEPTION 'medium required';
  END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived', closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.medium = _medium
     AND r.group_id IS NULL
     AND r.status = 'active'
     AND COALESCE(r.emptied_at, r.created_at) < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  SELECT r.id
    INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active' AND r.medium = _medium
     AND r.group_id IS NULL
     AND r.emptied_at IS NULL
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
    _title := 'Lounge: ' || initcap(_medium::text);
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', _title, NULL, 'active', _cap, _user_id, _medium)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- 4) Discovery: hide rooms currently in the emptied grace window.
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
     AND r.emptied_at IS NULL
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
GRANT EXECUTE ON FUNCTION public.join_lounge(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_medium_lounge(uuid, category, uuid[]) TO authenticated;
