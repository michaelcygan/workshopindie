ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS overflow integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workshop_venue_key text,
  ADD COLUMN IF NOT EXISTS venue_policy_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS venue_policy_confirmed_by uuid;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_overflow_nonnegative;
ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_overflow_nonnegative CHECK (overflow >= 0);

CREATE OR REPLACE FUNCTION public.reserve_event_rsvp(_event_id uuid, _status text, _plus_ones integer DEFAULT 0, _note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _ev record;
  _prev text;
  _attending boolean := _status IN ('going','maybe');
  _taken int;
  _max int;
  _effective text := _status;
BEGIN
  IF _uid IS NULL THEN RETURN 'forbidden'; END IF;

  SELECT id, capacity, overflow, waitlist_enabled, status, group_id, deleted_at
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

    -- No capacity means no ceiling; overflow alone never creates one.
    IF _ev.capacity IS NOT NULL
       AND (_prev IS NULL OR _prev NOT IN ('going','maybe')) THEN
      _max := _ev.capacity + COALESCE(_ev.overflow, 0);
      SELECT count(*)::int INTO _taken
        FROM public.group_event_rsvps
       WHERE event_id = _event_id AND status IN ('going','maybe');
      IF _taken >= _max THEN
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
    _event_id, _uid, _effective::group_event_rsvp_status, COALESCE(_plus_ones, 0), _note, NULL
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
$function$;