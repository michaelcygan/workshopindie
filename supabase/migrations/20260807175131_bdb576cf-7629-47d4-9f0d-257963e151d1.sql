-- One live room per Workshop.
CREATE UNIQUE INDEX IF NOT EXISTS instant_rooms_one_active_per_workshop
  ON public.instant_rooms (workshop_id)
  WHERE workshop_id IS NOT NULL AND status = 'active';

-- ---------------------------------------------------------------- Event RSVP
CREATE OR REPLACE FUNCTION public.reserve_event_rsvp(
  _event_id uuid,
  _status text,
  _plus_ones int DEFAULT 0,
  _note text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ev record;
  _prev text;
  _attending boolean := _status IN ('going','maybe');
  _taken int;
  _effective text := _status;
BEGIN
  IF _uid IS NULL THEN RETURN 'forbidden'; END IF;

  SELECT id, capacity, waitlist_enabled, status, group_id, deleted_at
    INTO _ev
    FROM public.group_events
   WHERE id = _event_id
     FOR UPDATE;

  IF NOT FOUND OR _ev.deleted_at IS NOT NULL THEN RETURN 'not_found'; END IF;

  SELECT status INTO _prev
    FROM public.group_event_rsvps
   WHERE event_id = _event_id AND user_id = _uid;

  IF _attending THEN
    IF _ev.status = 'canceled' THEN RETURN 'closed'; END IF;
    IF _ev.status = 'draft' THEN RETURN 'closed'; END IF;

    IF _ev.capacity IS NOT NULL
       AND (_prev IS NULL OR _prev NOT IN ('going','maybe')) THEN
      SELECT count(*)::int INTO _taken
        FROM public.group_event_rsvps
       WHERE event_id = _event_id AND status IN ('going','maybe');
      IF _taken >= _ev.capacity THEN
        IF COALESCE(_ev.waitlist_enabled, false) THEN
          _effective := 'waitlist';
        ELSE
          RETURN 'full';
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.group_event_rsvps (event_id, user_id, status, plus_ones, note, checked_in_at)
  VALUES (
    _event_id, _uid, _effective::group_event_rsvp_status, COALESCE(_plus_ones, 0), _note,
    CASE WHEN _attending THEN NULL ELSE NULL END
  )
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = EXCLUDED.status,
        plus_ones = EXCLUDED.plus_ones,
        note = EXCLUDED.note,
        checked_in_at = CASE WHEN _attending
                             THEN public.group_event_rsvps.checked_in_at
                             ELSE NULL END;

  RETURN _effective;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_event_rsvp(uuid, text, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_event_rsvp(uuid, text, int, text) TO authenticated, service_role;

-- ----------------------------------------------------------- Workshop seats
CREATE OR REPLACE FUNCTION public.reserve_workshop_seat(_workshop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ws record;
  _existing text;
  _taken int;
BEGIN
  IF _uid IS NULL THEN RETURN 'forbidden'; END IF;

  SELECT id, status, participant_cap, host_user_id
    INTO _ws
    FROM public.workshops
   WHERE id = _workshop_id
     FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF _ws.status IN ('canceled','archived','shipped') THEN RETURN 'closed'; END IF;

  SELECT participant_status::text INTO _existing
    FROM public.workshop_participants
   WHERE workshop_id = _workshop_id AND user_id = _uid
   LIMIT 1;

  IF _existing IS NOT NULL AND _existing NOT IN ('dropped','removed') THEN
    RETURN 'already_joined';
  END IF;

  IF _ws.participant_cap IS NOT NULL AND _uid <> _ws.host_user_id THEN
    SELECT count(*)::int INTO _taken
      FROM public.workshop_participants
     WHERE workshop_id = _workshop_id
       AND participant_status IN ('confirmed','checked_in','completed');
    IF _taken >= _ws.participant_cap THEN RETURN 'full'; END IF;
  END IF;

  IF _existing IS NOT NULL THEN
    UPDATE public.workshop_participants
       SET participant_status = 'confirmed'
     WHERE workshop_id = _workshop_id AND user_id = _uid;
  ELSE
    INSERT INTO public.workshop_participants (workshop_id, user_id, participant_status)
    VALUES (_workshop_id, _uid, 'confirmed');
  END IF;

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_workshop_seat(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_workshop_seat(uuid) TO authenticated, service_role;

-- --------------------------------------------------------- Live room joins
CREATE OR REPLACE FUNCTION public.join_instant_room(_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _room record;
  _cutoff timestamptz := now() - interval '5 minutes';
  _live int;
  _here boolean;
BEGIN
  IF _uid IS NULL THEN RETURN 'forbidden'; END IF;

  SELECT id, kind, status, participant_cap, locked, host_user_id
    INTO _room
    FROM public.instant_rooms
   WHERE id = _room_id
     FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF _room.status <> 'active' THEN RETURN 'closed'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _uid AND last_seen_at > _cutoff
  ) INTO _here;
  IF _here THEN RETURN 'already_joined'; END IF;

  IF COALESCE(_room.locked, false) AND _room.host_user_id IS DISTINCT FROM _uid THEN
    RETURN 'closed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.instant_room_removals
     WHERE room_id = _room_id AND user_id = _uid AND until > now()
  ) THEN
    RETURN 'forbidden';
  END IF;

  IF _room.participant_cap IS NOT NULL AND _room.host_user_id IS DISTINCT FROM _uid THEN
    SELECT count(*)::int INTO _live
      FROM public.instant_presence
     WHERE room_id = _room_id AND last_seen_at > _cutoff;
    IF _live >= _room.participant_cap THEN RETURN 'full'; END IF;
  END IF;

  RETURN 'joined';
END;
$$;

REVOKE ALL ON FUNCTION public.join_instant_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_instant_room(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------ DM threads
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  _other uuid,
  _context_collab_post_id uuid DEFAULT NULL,
  _context_workshop_id uuid DEFAULT NULL,
  _context_work_id uuid DEFAULT NULL,
  _context_comment_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL OR _other IS NULL OR _uid = _other THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;

  IF _uid < _other THEN _a := _uid; _b := _other; ELSE _a := _other; _b := _uid; END IF;

  INSERT INTO public.conversations (
    user_a, user_b, context_collab_post_id, context_workshop_id, context_work_id, context_comment_id
  ) VALUES (
    _a, _b, _context_collab_post_id, _context_workshop_id, _context_work_id, _context_comment_id
  )
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.conversations WHERE user_a = _a AND user_b = _b;
  END IF;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(uuid, uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid, uuid, uuid, uuid, uuid) TO authenticated, service_role;