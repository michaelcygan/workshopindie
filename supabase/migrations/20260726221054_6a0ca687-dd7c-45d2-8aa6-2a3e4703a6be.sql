
-- Host-less Lounge mic queue: skip the "offered" step; promote directly to speaker.

CREATE OR REPLACE FUNCTION public.request_lounge_audio_slot(_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _speakers int;
  _queue_pos int;
  _final_state text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.instant_presence
     WHERE room_id = _room_id AND user_id = _uid
  ) THEN
    RAISE EXCEPTION 'not in room';
  END IF;

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';

  IF _speakers < 10 THEN
    UPDATE public.instant_presence
       SET audio_state = 'speaker',
           audio_requested_at = COALESCE(audio_requested_at, now()),
           audio_joined_at = now(),
           audio_offer_expires_at = NULL
     WHERE room_id = _room_id AND user_id = _uid;
    _final_state := 'speaker';
    _queue_pos := 0;
  ELSE
    UPDATE public.instant_presence
       SET audio_state = 'waiting',
           audio_requested_at = COALESCE(audio_requested_at, now()),
           audio_offer_expires_at = NULL
     WHERE room_id = _room_id AND user_id = _uid;
    SELECT count(*)::int INTO _queue_pos
      FROM public.instant_presence p1
      JOIN public.instant_presence p2
        ON p2.room_id = p1.room_id AND p2.user_id = _uid
     WHERE p1.room_id = _room_id
       AND p1.audio_state = 'waiting'
       AND p1.audio_requested_at <= p2.audio_requested_at;
    _final_state := 'waiting';
  END IF;

  RETURN jsonb_build_object(
    'state', _final_state,
    'queuePosition', _queue_pos,
    'speakerCount', _speakers
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_next_lounge_listener(_room_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _speakers int;
  _next_user uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';

  IF _speakers >= 10 THEN RETURN; END IF;

  SELECT user_id INTO _next_user
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state IN ('waiting','offered')
   ORDER BY audio_requested_at ASC NULLS LAST
   LIMIT 1;

  IF _next_user IS NULL THEN RETURN; END IF;

  UPDATE public.instant_presence
     SET audio_state = 'speaker',
         audio_joined_at = now(),
         audio_offer_expires_at = NULL
   WHERE room_id = _room_id AND user_id = _next_user;
END;
$$;

-- Kept for backward compatibility with any in-flight client; now just a
-- no-op if already speaker, else promotes waiting -> speaker if under cap.
CREATE OR REPLACE FUNCTION public.accept_lounge_audio_offer(_room_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _speakers int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lounge-audio-queue:' || _room_id::text));

  SELECT count(*)::int INTO _speakers
    FROM public.instant_presence
   WHERE room_id = _room_id AND audio_state = 'speaker';

  IF _speakers >= 10 THEN
    RAISE EXCEPTION 'speaker cap reached';
  END IF;

  UPDATE public.instant_presence
     SET audio_state = 'speaker',
         audio_joined_at = now(),
         audio_offer_expires_at = NULL
   WHERE room_id = _room_id AND user_id = _uid
     AND audio_state IN ('waiting','offered');

  RETURN jsonb_build_object('state', 'speaker', 'speakerCount', _speakers + 1);
END;
$$;
