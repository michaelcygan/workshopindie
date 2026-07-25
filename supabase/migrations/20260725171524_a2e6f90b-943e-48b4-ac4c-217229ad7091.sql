-- 1. Bump default and existing caps
ALTER TABLE public.instant_rooms
  ALTER COLUMN participant_cap SET DEFAULT 10;

UPDATE public.instant_rooms
   SET participant_cap = 10
 WHERE kind = 'lounge'
   AND status = 'active'
   AND (participant_cap IS NULL OR participant_cap < 10);

-- 2. Screen-share lease columns
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS screen_sharer_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS screen_share_claimed_at timestamptz NULL;

-- 3. claim_lounge_slot: default cap 10, and read from room if present
CREATE OR REPLACE FUNCTION public.claim_lounge_slot(_room_id uuid, _user_id uuid, _cap integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  live_count int;
  already_here boolean;
  room_cap int;
  effective_cap int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lounge-slot:' || _room_id::text));

  DELETE FROM public.instant_presence
   WHERE room_id = _room_id
     AND last_seen_at < now() - interval '5 minutes';

  SELECT participant_cap INTO room_cap FROM public.instant_rooms WHERE id = _room_id;
  effective_cap := COALESCE(room_cap, _cap, 10);

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
    RETURN jsonb_build_object('status', 'rejoined', 'count', live_count, 'cap', effective_cap);
  END IF;

  SELECT count(*)::int INTO live_count
    FROM public.instant_presence WHERE room_id = _room_id;

  IF live_count >= effective_cap THEN
    RETURN jsonb_build_object('status', 'full', 'count', live_count, 'cap', effective_cap);
  END IF;

  INSERT INTO public.instant_presence(room_id, user_id, status, last_seen_at)
  VALUES (_room_id, _user_id, 'active', now());

  UPDATE public.instant_rooms
     SET emptied_at = NULL
   WHERE id = _room_id;

  RETURN jsonb_build_object('status', 'joined', 'count', live_count + 1, 'cap', effective_cap);
END;
$function$;

-- 4. join_lounge: 10-cap, per-room participant_cap in matchmaker
CREATE OR REPLACE FUNCTION public.join_lounge(_user_id uuid, _exclude_room_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _room_id uuid;
  _stale_cutoff timestamptz := now() - interval '30 seconds';
  _live_cutoff  timestamptz := now() - interval '5 minutes';
  _default_cap int := 10;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  UPDATE public.instant_rooms r
     SET status = 'archived', closed_at = now()
   WHERE r.kind = 'lounge' AND r.medium IS NULL AND r.group_id IS NULL
     AND r.status = 'active'
     AND COALESCE(r.emptied_at, r.created_at) < _stale_cutoff
     AND NOT EXISTS (
       SELECT 1 FROM public.instant_presence p
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
     );

  SELECT r.id INTO _room_id
    FROM public.instant_rooms r
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS live_count
        FROM public.instant_presence p
       WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
    ) lc ON true
   WHERE r.kind = 'lounge' AND r.status = 'active'
     AND r.medium IS NULL AND r.group_id IS NULL
     AND r.emptied_at IS NULL
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
        WHERE p.room_id = r.id AND p.last_seen_at > _live_cutoff
          AND public.is_blocked_pair(_user_id, p.user_id)
     )
   ORDER BY
     (r.host_user_id IS NOT NULL AND public.is_follow(_user_id, r.host_user_id)) DESC,
     COALESCE(lc.live_count, 0) DESC,
     r.created_at ASC
   LIMIT 1;

  IF _room_id IS NULL THEN
    INSERT INTO public.instant_rooms (kind, title, slug, status, participant_cap, creator_id, medium)
    VALUES ('lounge', 'Artist''s Lounge', NULL, 'active', _default_cap, _user_id, NULL)
    RETURNING id INTO _room_id;
  END IF;

  RETURN _room_id;
END;
$function$;

-- 5. Screen-share lease RPCs
-- Stale lease timeout: 45s of no refresh
CREATE OR REPLACE FUNCTION public.claim_lounge_screen_share(_room_id uuid, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_holder uuid;
  claimed_at timestamptz;
  stale boolean;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lounge-screen:' || _room_id::text));

  -- Caller must actually be in the room (presence-authoritative)
  IF NOT EXISTS (
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _user_id
       AND last_seen_at > now() - interval '5 minutes'
  ) THEN
    RETURN jsonb_build_object('status', 'not_in_room');
  END IF;

  SELECT screen_sharer_user_id, screen_share_claimed_at
    INTO current_holder, claimed_at
    FROM public.instant_rooms
   WHERE id = _room_id
   FOR UPDATE;

  stale := claimed_at IS NULL OR claimed_at < now() - interval '45 seconds';

  IF current_holder IS NULL OR current_holder = _user_id OR stale THEN
    UPDATE public.instant_rooms
       SET screen_sharer_user_id = _user_id,
           screen_share_claimed_at = now()
     WHERE id = _room_id;
    RETURN jsonb_build_object('status', 'claimed', 'sharer', _user_id);
  END IF;

  RETURN jsonb_build_object('status', 'busy', 'sharer', current_holder);
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_lounge_screen_share(_room_id uuid, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated int;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  UPDATE public.instant_rooms
     SET screen_share_claimed_at = now()
   WHERE id = _room_id
     AND screen_sharer_user_id = _user_id;
  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated = 0 THEN
    RETURN jsonb_build_object('status', 'lost');
  END IF;
  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_lounge_screen_share(_room_id uuid, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;

  UPDATE public.instant_rooms
     SET screen_sharer_user_id = NULL,
         screen_share_claimed_at = NULL
   WHERE id = _room_id
     AND screen_sharer_user_id = _user_id;

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_lounge_screen_share(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_lounge_screen_share(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_lounge_screen_share(uuid, uuid) TO authenticated;