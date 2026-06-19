
ALTER TABLE public.instant_presence
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows so current presence rows aren't all "just joined"
UPDATE public.instant_presence SET first_seen_at = last_seen_at WHERE first_seen_at > last_seen_at;

CREATE OR REPLACE FUNCTION public.start_host_claim(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _room public.instant_rooms;
  _first_seen timestamptz;
  _cooldown_until timestamptz;
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO _room FROM public.instant_rooms WHERE id = _room_id;
  IF _room IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _room.host_user_id IS NOT NULL THEN RAISE EXCEPTION 'This Workshop already has a host'; END IF;
  IF _room.status <> 'active' THEN RAISE EXCEPTION 'Room is not active'; END IF;
  IF _room.kind <> 'lounge' THEN RAISE EXCEPTION 'This room can''t be claimed'; END IF;
  IF _room.workshop_id IS NOT NULL THEN RAISE EXCEPTION 'This room can''t be claimed'; END IF;

  SELECT until INTO _cooldown_until
    FROM public.instant_room_claim_cooldowns
   WHERE room_id = _room_id AND user_id = _viewer;
  IF _cooldown_until IS NOT NULL AND _cooldown_until > now() THEN
    RAISE EXCEPTION 'Try again in a few minutes';
  END IF;

  SELECT first_seen_at INTO _first_seen
    FROM public.instant_presence
   WHERE room_id = _room_id AND user_id = _viewer;
  IF _first_seen IS NULL THEN RAISE EXCEPTION 'Join the room first'; END IF;
  IF now() - _first_seen < interval '60 seconds' THEN
    RAISE EXCEPTION 'Hang out for a minute before claiming';
  END IF;

  IF _room.claim_user_id IS NOT NULL
     AND _room.claim_started_at IS NOT NULL
     AND now() - _room.claim_started_at < interval '10 seconds'
     AND _room.claim_vetoed = false THEN
    RAISE EXCEPTION 'Someone else is claiming right now';
  END IF;

  UPDATE public.instant_rooms
     SET claim_user_id = _viewer,
         claim_started_at = now(),
         claim_vetoed = false
   WHERE id = _room_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_host_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_host_claim(uuid) TO authenticated;
