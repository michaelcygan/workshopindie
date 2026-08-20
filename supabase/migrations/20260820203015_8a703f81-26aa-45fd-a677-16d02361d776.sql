ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS adult_attested_at timestamptz;

UPDATE public.profiles
   SET adult_attested_at = COALESCE(adult_attested_at, now())
 WHERE birthdate IS NOT NULL
   AND birthdate <= (CURRENT_DATE - INTERVAL '18 years')::date;

CREATE OR REPLACE FUNCTION public.is_adult(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _user_id
       AND (p.adult_attested_at IS NOT NULL
            OR (p.birthdate IS NOT NULL AND p.birthdate <= (CURRENT_DATE - INTERVAL '18 years')::date))
  )
$function$;

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

  SELECT id, capacity, overflow, waitlist_enabled, status, group_id, deleted_at, min_age, kind
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

    -- Platform rule: Workshop accounts are 18+ (attested). Venue rules above 18
    -- (e.g. 21+) are surfaced on the event page and verified with ID on site.
    IF _ev.min_age IS NOT NULL THEN
      IF NOT public.is_adult(_uid) THEN RETURN 'age_unknown'; END IF;
    END IF;

    -- Co-working sessions never take plus-ones.
    IF _ev.kind::text = 'coworking' THEN
      _plus_ones := 0;
    END IF;

    -- No capacity means no ceiling; overflow alone never creates one.
    IF _ev.capacity IS NOT NULL
       AND (_prev IS NULL OR _prev NOT IN ('going','maybe')) THEN
      _max := public.event_max_rsvps(_ev.capacity, _ev.overflow);
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

CREATE OR REPLACE FUNCTION public.tg_workshop_applications_age_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _min int;
  _max int;
BEGIN
  SELECT min_age, max_age INTO _min, _max FROM public.workshops WHERE id = NEW.workshop_id;
  IF _min IS NULL AND _max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Workshop accounts are 18+ by attestation; stricter venue/host rules are
  -- stated on the workshop and verified in person.
  IF NOT public.is_adult(NEW.user_id) THEN
    RAISE EXCEPTION 'Confirm that you are 18 or older to apply.';
  END IF;

  RETURN NEW;
END;
$function$;