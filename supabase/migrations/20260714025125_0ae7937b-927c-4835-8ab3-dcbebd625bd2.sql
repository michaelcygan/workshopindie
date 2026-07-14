-- Make Lounge lifecycle more forgiving and prevent immediate auto-archive on last presence delete.

-- 1) Atomic Lounge slot claim: keep seats resilient to missed heartbeats.
CREATE OR REPLACE FUNCTION public.claim_lounge_slot(
  _room_id uuid,
  _user_id uuid,
  _cap int DEFAULT 5
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  live_count int;
  already_here boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lounge-slot:' || _room_id::text));

  -- Sweep only truly stale rows. A 60s cutoff was too aggressive for brief
  -- browser/network pauses and could make an active Lounge look empty.
  DELETE FROM public.instant_presence
   WHERE room_id = _room_id
     AND last_seen_at < now() - interval '5 minutes';

  SELECT EXISTS(
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _user_id
  ) INTO already_here;

  IF already_here THEN
    UPDATE public.instant_presence
       SET last_seen_at = now(), status = 'active'
     WHERE room_id = _room_id AND user_id = _user_id;
    SELECT count(*)::int INTO live_count
      FROM public.instant_presence WHERE room_id = _room_id;
    RETURN jsonb_build_object('status', 'rejoined', 'count', live_count);
  END IF;

  SELECT count(*)::int INTO live_count
    FROM public.instant_presence WHERE room_id = _room_id;

  IF live_count >= _cap THEN
    RETURN jsonb_build_object('status', 'full', 'count', live_count);
  END IF;

  INSERT INTO public.instant_presence(room_id, user_id, status, last_seen_at)
  VALUES (_room_id, _user_id, 'active', now());

  UPDATE public.instant_rooms
     SET emptied_at = NULL
   WHERE id = _room_id;

  RETURN jsonb_build_object('status', 'joined', 'count', live_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_lounge_slot(uuid, uuid, int) TO authenticated, service_role;

-- 2) Do not archive immediately when the last presence row is deleted.
--    Mark the room empty and let the scheduled sweeper archive later.
CREATE OR REPLACE FUNCTION public.tg_instant_presence_archive_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
  room_kind text;
BEGIN
  SELECT count(*)::int INTO remaining
    FROM public.instant_presence
    WHERE room_id = OLD.room_id;

  IF remaining > 0 THEN
    RETURN NULL;
  END IF;

  SELECT kind INTO room_kind FROM public.instant_rooms WHERE id = OLD.room_id;
  IF room_kind IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.instant_whiteboard_assets WHERE room_id = OLD.room_id;
  DELETE FROM public.instant_board_items WHERE room_id = OLD.room_id;

  IF room_kind = 'lounge' THEN
    UPDATE public.instant_rooms
       SET emptied_at = COALESCE(emptied_at, now())
     WHERE id = OLD.room_id AND status = 'active';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS instant_presence_archive_empty ON public.instant_presence;
CREATE TRIGGER instant_presence_archive_empty
AFTER DELETE ON public.instant_presence
FOR EACH ROW
EXECUTE FUNCTION public.tg_instant_presence_archive_empty();

-- 3) Scheduled cleanup: consider users live for 5 minutes and archive only
--    after a Lounge has been empty for 30 minutes.
CREATE OR REPLACE FUNCTION public.sweep_stale_lounges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live_cutoff timestamptz := now() - interval '5 minutes';
  _grace_cutoff timestamptz := now() - interval '30 minutes';
  _delete_cutoff timestamptz := now() - interval '24 hours';
BEGIN
  UPDATE public.instant_rooms r
     SET emptied_at = NULL
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  UPDATE public.instant_rooms r
     SET emptied_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  UPDATE public.instant_rooms r
     SET status = 'archived',
         closed_at = now()
   WHERE r.kind = 'lounge'
     AND r.status = 'active'
     AND r.emptied_at IS NOT NULL
     AND r.emptied_at < _grace_cutoff;

  DELETE FROM public.instant_rooms r
   WHERE r.kind = 'lounge'
     AND r.status = 'archived'
     AND r.closed_at IS NOT NULL
     AND r.closed_at < _delete_cutoff;
END;
$$;

-- 4) Matchmaker cleanup: use a 30-minute stale-empty threshold, not 5 minutes.
CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid, _exclude_room_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '30 minutes';
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
     (COALESCE(lc.live_count, 0) > 0) DESC,
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

CREATE OR REPLACE FUNCTION public.join_medium_lounge(_user_id uuid, _medium category, _exclude_room_ids uuid[] DEFAULT '{}')
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '30 minutes';
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
     (COALESCE(lc.live_count, 0) > 0) DESC,
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
  _stale_cutoff timestamptz := now() - interval '30 minutes';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _cap int := 5;
  _group_name text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  IF _group_id IS NULL THEN RAISE EXCEPTION 'group required'; END IF;

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
     (COALESCE(lc.live_count, 0) > 0) DESC,
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

GRANT EXECUTE ON FUNCTION public.join_lounge(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_medium_lounge(uuid, category, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_lounge(uuid, uuid, uuid[]) TO authenticated;

-- 5) Retire the old aggressive no-presence cron job if it still exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'instant_lounges_archive_idle') THEN
    PERFORM cron.unschedule('instant_lounges_archive_idle');
  END IF;
END $$;