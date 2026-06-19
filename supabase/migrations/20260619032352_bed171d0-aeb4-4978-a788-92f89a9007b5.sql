
-- Claim-tracking columns on instant_rooms
ALTER TABLE public.instant_rooms
  ADD COLUMN IF NOT EXISTS claim_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_vetoed boolean NOT NULL DEFAULT false;

-- Per-user, per-room cooldown after a vetoed claim
CREATE TABLE IF NOT EXISTS public.instant_room_claim_cooldowns (
  room_id uuid NOT NULL REFERENCES public.instant_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  until timestamptz NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

GRANT SELECT ON public.instant_room_claim_cooldowns TO authenticated;
GRANT ALL ON public.instant_room_claim_cooldowns TO service_role;

ALTER TABLE public.instant_room_claim_cooldowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self read cooldown" ON public.instant_room_claim_cooldowns;
CREATE POLICY "self read cooldown" ON public.instant_room_claim_cooldowns
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Start a claim on a leaderless lounge room
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

  -- Cooldown check
  SELECT until INTO _cooldown_until
    FROM public.instant_room_claim_cooldowns
   WHERE room_id = _room_id AND user_id = _viewer;
  IF _cooldown_until IS NOT NULL AND _cooldown_until > now() THEN
    RAISE EXCEPTION 'Try again in a few minutes';
  END IF;

  -- Dwell + presence check (~60s of dwell, heartbeat within 60s)
  SELECT created_at INTO _first_seen
    FROM public.instant_presence
   WHERE room_id = _room_id AND user_id = _viewer;
  IF _first_seen IS NULL THEN RAISE EXCEPTION 'Join the room first'; END IF;
  IF now() - _first_seen < interval '60 seconds' THEN
    RAISE EXCEPTION 'Hang out for a minute before claiming';
  END IF;

  -- Another claim is currently mid-window
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

-- Object to an in-flight claim (any single objector vetoes)
CREATE OR REPLACE FUNCTION public.object_host_claim(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _room public.instant_rooms;
  _present boolean;
BEGIN
  IF _viewer IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT * INTO _room FROM public.instant_rooms WHERE id = _room_id;
  IF _room IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF _room.claim_user_id IS NULL OR _room.claim_started_at IS NULL THEN
    RAISE EXCEPTION 'No claim in progress';
  END IF;
  IF _room.claim_user_id = _viewer THEN RAISE EXCEPTION 'You can''t object to your own claim'; END IF;
  IF now() - _room.claim_started_at > interval '10 seconds' THEN
    RAISE EXCEPTION 'The claim window has ended';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _viewer
       AND last_seen_at > now() - interval '60 seconds'
  ) INTO _present;
  IF NOT _present THEN RAISE EXCEPTION 'You''re not in the room'; END IF;

  -- Cooldown the claimant against this room
  INSERT INTO public.instant_room_claim_cooldowns(room_id, user_id, until)
       VALUES (_room_id, _room.claim_user_id, now() + interval '5 minutes')
  ON CONFLICT (room_id, user_id) DO UPDATE SET until = EXCLUDED.until;

  UPDATE public.instant_rooms
     SET claim_vetoed = true,
         claim_user_id = NULL,
         claim_started_at = NULL
   WHERE id = _room_id;
END;
$$;

-- Finalize after 10s — promote claimant if not vetoed
CREATE OR REPLACE FUNCTION public.finalize_host_claim(_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _room public.instant_rooms;
BEGIN
  SELECT * INTO _room FROM public.instant_rooms WHERE id = _room_id;
  IF _room IS NULL THEN RETURN; END IF;
  IF _room.host_user_id IS NOT NULL THEN RETURN; END IF;
  IF _room.claim_user_id IS NULL OR _room.claim_started_at IS NULL THEN RETURN; END IF;
  IF _room.claim_vetoed THEN RETURN; END IF;
  IF now() - _room.claim_started_at < interval '10 seconds' THEN RETURN; END IF;

  UPDATE public.instant_rooms
     SET host_user_id = _room.claim_user_id,
         claim_user_id = NULL,
         claim_started_at = NULL,
         claim_vetoed = false
   WHERE id = _room_id
     AND host_user_id IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_host_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.object_host_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_host_claim(uuid) TO authenticated;
