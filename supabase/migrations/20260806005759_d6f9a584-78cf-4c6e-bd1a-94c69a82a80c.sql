-- Allow deactivated localities
ALTER TABLE public.cities DROP CONSTRAINT IF EXISTS cities_status_check;
ALTER TABLE public.cities ADD CONSTRAINT cities_status_check
  CHECK (status = ANY (ARRAY['provisioning','active','paused','failed','merged','deactivated']));

CREATE OR REPLACE FUNCTION public.set_city_status(_city uuid, _status text, _clear_review boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _status NOT IN ('active','paused','deactivated') THEN
    RAISE EXCEPTION 'Unsupported status %', _status;
  END IF;

  UPDATE public.cities
     SET status = _status,
         needs_review = CASE WHEN _clear_review THEN false ELSE needs_review END,
         updated_at = now()
   WHERE id = _city
     AND status <> 'merged';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'City not found or already merged';
  END IF;

  PERFORM public.admin_log('city.status', 'city', _city::text,
    jsonb_build_object('status', _status, 'clear_review', _clear_review));
END;
$$;

REVOKE ALL ON FUNCTION public.set_city_status(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_city_status(uuid, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_city(_source uuid, _target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Cannot merge a city into itself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cities WHERE id = _source) THEN
    RAISE EXCEPTION 'Source city not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cities WHERE id = _target AND status <> 'merged') THEN
    RAISE EXCEPTION 'Target city not found or is itself merged';
  END IF;

  UPDATE public.profiles SET home_city_id = _target WHERE home_city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('profiles_home', n);

  UPDATE public.profiles SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('profiles_city', n);

  UPDATE public.works SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('works', n);

  UPDATE public.collab_posts SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('collabs', n);

  UPDATE public.workshops SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('workshops', n);

  UPDATE public.group_events SET venue_city_id = _target WHERE venue_city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('events', n);

  UPDATE public.instant_rooms SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('rooms', n);

  UPDATE public.standing_meetups SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('meetups', n);

  UPDATE public.groups SET city_id = _target WHERE city_id = _source;
  GET DIAGNOSTICS n = ROW_COUNT; moved := moved || jsonb_build_object('groups', n);

  UPDATE public.city_launch_queue SET city_id = _target WHERE city_id = _source;

  UPDATE public.cities
     SET status = 'merged',
         merged_into_city_id = _target,
         needs_review = false,
         official_group_id = NULL,
         updated_at = now()
   WHERE id = _source;

  PERFORM public.admin_log('city.merge', 'city', _source::text,
    jsonb_build_object('target', _target, 'moved', moved));

  RETURN moved;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_city(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_city(uuid, uuid) TO authenticated;