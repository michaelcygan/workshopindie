CREATE OR REPLACE FUNCTION public.join_group_lounge(_user_id uuid, _group_id uuid, _exclude_room_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '30 minutes';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _default_cap int := 20;
  _group_name text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _group_id IS NULL THEN RAISE EXCEPTION 'group required'; END IF;

  -- Archive stale, empty group rooms.
  UPDATE public.instant_rooms r
     SET status = 'archived', closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.group_id = _group_id
     AND r.status = 'active'
     AND COALESCE(r.emptied_at, r.created_at) < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  -- Fill the most populated non-full room first.
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
     AND COALESCE(lc.live_count, 0) < COALESCE(r.participant_cap, _default_cap)
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
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    SELECT name INTO _group_name FROM public.groups WHERE id = _group_id;
    INSERT INTO public.instant_rooms (kind, title, status, participant_cap, creator_id, host_user_id, group_id, visibility)
    VALUES ('lounge', COALESCE(_group_name, 'Group') || ' · Lounge', 'active', _default_cap, _user_id, NULL, _group_id, 'open')
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

UPDATE public.instant_rooms
   SET participant_cap = 20
 WHERE kind = 'lounge'
   AND group_id IS NOT NULL
   AND status = 'active'
   AND COALESCE(participant_cap, 0) < 20;

CREATE OR REPLACE FUNCTION public.moderate_lounge_speaker(_room_id uuid, _target_user_id uuid, _action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  host uuid;
  _group uuid;
  _allowed boolean := false;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _action NOT IN ('mute', 'remove') THEN
    RAISE EXCEPTION 'invalid action %', _action;
  END IF;

  SELECT host_user_id, group_id INTO host, _group
    FROM public.instant_rooms WHERE id = _room_id;

  IF public.has_role(caller, 'admin') THEN
    _allowed := true;
  ELSIF host IS NOT NULL AND host = caller THEN
    _allowed := true;
  ELSIF _group IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members gm
     WHERE gm.group_id = _group
       AND gm.user_id = caller
       AND gm.role IN ('owner', 'steward')
  ) THEN
    _allowed := true;
  END IF;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  UPDATE public.instant_presence
     SET audio_state = 'listener',
         audio_requested_at = NULL,
         audio_offer_expires_at = NULL,
         audio_joined_at = NULL
   WHERE room_id = _room_id
     AND user_id = _target_user_id
     AND audio_state IN ('speaker', 'offered', 'waiting');

  INSERT INTO public.lounge_audio_events (room_id, user_id, event, payload)
  VALUES (
    _room_id,
    _target_user_id,
    CASE WHEN _action = 'remove' THEN 'moderator_removed' ELSE 'moderator_muted' END,
    jsonb_build_object('by', caller)
  );

  IF _action = 'remove' THEN
    DELETE FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _target_user_id;
    INSERT INTO public.instant_room_removals (room_id, user_id, removed_by, until)
    VALUES (_room_id, _target_user_id, caller, now() + interval '2 hours')
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET until = EXCLUDED.until, removed_by = EXCLUDED.removed_by;
  END IF;
END;
$function$;