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
    RETURN 'locked';
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