-- ---------------------------------------------------------------- venues --
CREATE TABLE IF NOT EXISTS public.event_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  venue_name text NOT NULL,
  address text,
  neighborhood text,
  venue_type text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  lat double precision,
  lng double precision,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','scout_later','inactive')),
  coworking_eligible boolean NOT NULL DEFAULT false,
  open_house_eligible boolean NOT NULL DEFAULT false,
  relationship_status text NOT NULL DEFAULT 'ordinary_public_venue',
  reservation_policy text,
  seating_policy text,
  small_groups_allowed boolean,
  group_threshold integer,
  threshold_kind text NOT NULL DEFAULT 'unknown' CHECK (threshold_kind IN ('hard','soft','unknown')),
  wifi text NOT NULL DEFAULT 'unknown' CHECK (wifi IN ('yes','no','unknown')),
  power text NOT NULL DEFAULT 'unknown' CHECK (power IN ('likely','limited','unavailable','unknown')),
  dayparts text[] NOT NULL DEFAULT '{}',
  activity_types text[] NOT NULL DEFAULT '{}',
  noise_note text,
  purchase_expected boolean NOT NULL DEFAULT true,
  food_note text,
  indoor_outdoor text,
  accessibility_note text,
  min_age integer,
  min_age_after_local_time time,
  min_age_after integer,
  age_policy_note text,
  programming_conflicts text,
  policy_source_url text,
  policy_verified_at date,
  default_capacity integer,
  default_overflow integer,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Public projection: internal_note / programming_conflicts stay out of the API.
GRANT SELECT (
  id, key, venue_name, address, neighborhood, venue_type, city_id, lat, lng,
  status, coworking_eligible, open_house_eligible, relationship_status,
  reservation_policy, seating_policy, small_groups_allowed, group_threshold,
  threshold_kind, wifi, power, dayparts, activity_types, noise_note,
  purchase_expected, food_note, indoor_outdoor, accessibility_note, min_age,
  min_age_after_local_time, min_age_after, age_policy_note, policy_source_url,
  policy_verified_at, default_capacity, default_overflow, created_at, updated_at
) ON public.event_venues TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.event_venues TO authenticated;
GRANT ALL ON public.event_venues TO service_role;

ALTER TABLE public.event_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Venues are publicly readable" ON public.event_venues;
CREATE POLICY "Venues are publicly readable"
  ON public.event_venues FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage venues" ON public.event_venues;
CREATE POLICY "Admins manage venues"
  ON public.event_venues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS event_venues_updated_at ON public.event_venues;
CREATE TRIGGER event_venues_updated_at
  BEFORE UPDATE ON public.event_venues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ------------------------------------------------------- event additions --
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.event_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS daypart public.event_daypart,
  ADD COLUMN IF NOT EXISTS min_age integer,
  ADD COLUMN IF NOT EXISTS facilitation text NOT NULL DEFAULT 'hosted',
  ADD COLUMN IF NOT EXISTS drop_in_allowed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_activities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS arrival_note_public text,
  ADD COLUMN IF NOT EXISTS series_mode text;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_facilitation_check;
ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_facilitation_check CHECK (facilitation IN ('hosted','hostless'));

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_min_age_check;
ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_min_age_check CHECK (min_age IS NULL OR (min_age BETWEEN 1 AND 99));

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_series_mode_check;
ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_series_mode_check CHECK (series_mode IS NULL OR series_mode IN ('recurring','rotation'));

CREATE INDEX IF NOT EXISTS group_events_kind_starts_idx ON public.group_events (kind, starts_at);

-- ------------------------------------------------- internal ops per event --
CREATE TABLE IF NOT EXISTS public.event_ops (
  event_id uuid PRIMARY KEY REFERENCES public.group_events(id) ON DELETE CASCADE,
  admin_note text,
  preflight_status text NOT NULL DEFAULT 'check_required'
    CHECK (preflight_status IN ('check_required','checked','issue_found')),
  preflight_checked_at timestamptz,
  preflight_checked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_ops TO authenticated;
GRANT ALL ON public.event_ops TO service_role;
ALTER TABLE public.event_ops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage event ops" ON public.event_ops;
CREATE POLICY "Admins manage event ops"
  ON public.event_ops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_event_host(event_id, auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_event_host(event_id, auth.uid()));

DROP TRIGGER IF EXISTS event_ops_updated_at ON public.event_ops;
CREATE TRIGGER event_ops_updated_at
  BEFORE UPDATE ON public.event_ops
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ------------------------------------------------------- shared max rsvps --
CREATE OR REPLACE FUNCTION public.event_max_rsvps(_capacity integer, _overflow integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _capacity IS NULL THEN NULL
              ELSE _capacity + GREATEST(COALESCE(_overflow, 0), 0) END
$$;
REVOKE ALL ON FUNCTION public.event_max_rsvps(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_max_rsvps(integer, integer) TO anon, authenticated, service_role;

-- --------------------------------------------- rsvp: age gate + max rsvps --
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
  _birthdate date;
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

    -- Server-side age eligibility. The birthdate itself is never returned.
    IF _ev.min_age IS NOT NULL THEN
      SELECT birthdate INTO _birthdate FROM public.profiles WHERE id = _uid;
      IF _birthdate IS NULL THEN RETURN 'age_unknown'; END IF;
      IF _birthdate > (current_date - (_ev.min_age || ' years')::interval) THEN
        RETURN 'age_restricted';
      END IF;
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

-- ------------------------------------------------------------ venue seed --
INSERT INTO public.event_venues (key, venue_name, address, neighborhood, venue_type, lat, lng,
  status, coworking_eligible, open_house_eligible, reservation_policy, seating_policy,
  small_groups_allowed, group_threshold, threshold_kind, wifi, power, dayparts,
  activity_types, purchase_expected, food_note, indoor_outdoor, min_age, age_policy_note,
  programming_conflicts, policy_source_url, policy_verified_at, default_capacity, default_overflow, internal_note)
VALUES
  ('chi_begyle_brewing','Begyle Brewing','1800 W Cuyler Ave, Chicago, IL 60613','Ravenswood','Brewery taproom',41.9573,-87.6742,
   'active',true,true,'Small groups are explicitly walk-in and first-come. Groups of 15 or more enter the reservation flow.','First come, first served ordinary public seating.',
   true,15,'soft','unknown','likely','{morning,afternoon}','{writing,laptop,reading,research,study,sketching,handwork,contained_art}',true,null,null,null,null,
   'Begyle programs work-from-the-taproom activities — check the taproom calendar.','https://www.begylebrewing.com/','2026-08-17',8,4,'Morning flagship for Co-working.'),
  ('chi_long_room','Long Room','1612 W Irving Park Rd, Chicago, IL 60613','North Center','Bar / cafe-style room',41.9541,-87.6690,
   'active',true,false,'No ordinary reservations for small groups.','First come, first served ordinary public seating.',
   true,null,'unknown','unknown','likely','{morning,afternoon}','{writing,laptop,reading,research,study,sketching,handwork}',true,null,'Indoor room with long communal seating',null,null,
   null,null,null,6,3,'Morning coverage on the North Side.'),
  ('chi_off_color_mousetrap','Off Color Brewing — Mousetrap','1460 N Kingsbury St, Chicago, IL 60642','Lincoln Park / North Branch','Brewery taproom',41.9083,-87.6527,
   'active',true,true,'First-come, first-served. Off Color does not take reservations or hold tables.','First come, first served ordinary public seating.',
   true,null,'unknown','yes','likely','{afternoon,evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,'No kitchen — outside food is welcome','Indoor taproom with seasonal outdoor areas',null,'21+ after 6 PM',
   null,'https://www.offcolorbrewing.com/mousetrap','2026-08-17',6,3,'Chicago home base.'),
  ('chi_solemn_oath_still_life','Solemn Oath Brewery — Still Life','2919 W Armitage Ave, Chicago, IL 60647','Logan Square','Brewery taproom',41.9174,-87.7013,
   'active',true,false,'Walk-in policy not verified in writing; confirm before automating.','First come, first served ordinary public seating.',
   null,null,'unknown','unknown','unknown','{evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,'Regular food pop-ups','Large taproom with communal seating',null,null,
   'Food pop-ups and programming vary — verify before publishing.','https://www.solemnoathbrewery.com/',null,6,2,'Evening coverage; walk-in policy unverified.'),
  ('chi_goose_island_fulton','Goose Island — Fulton Street Taproom','1800 W Fulton St, Chicago, IL 60612','West Town',
   'Brewery taproom',41.8866,-87.6721,'active',true,false,'No ordinary reservations — visitors are instructed to walk in.','First come, first served ordinary public seating.',
   true,null,'unknown','unknown','unknown','{afternoon,evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,'Snacks available',null,null,null,
   'Currently closed Mondays and Tuesdays.','https://www.gooseisland.com/pages/fulton-street-taproom','2026-08-17',6,3,'Afternoon and early evening coverage.'),
  ('chi_district_brew_yards_west_loop','District Brew Yards — West Loop','417 N Ashland Ave, Chicago, IL 60622','West Loop','Self-pour brewery',41.8893,-87.6672,
   'active',true,true,'Ordinary seating is first-come; the venue does not take ordinary reservations.','First come, first served ordinary public seating.',
   true,null,'unknown','unknown','likely','{evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,'On-site kitchen; outside food generally not permitted','Large communal indoor beer hall',21,'21+ at all times',
   null,'https://districtbrewyards.com/','2026-08-17',8,2,'Self-pour, individual payment — strong for hostless sessions.'),
  ('chi_half_acre_balmoral','Half Acre Beer — Balmoral','2050 W Balmoral Ave, Chicago, IL 60625','Bowmanville','Brewery taproom and beer garden',41.9797,-87.6807,
   'active',true,true,'Half Acre does not offer ordinary reservations. Groups of 10 or more are directed into the Host an Event flow.','First come, first served ordinary public seating.',
   true,10,'hard','unknown','limited','{afternoon,evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,null,'Indoor taproom and seasonal beer garden',null,'Minors welcome with an adult 21+',
   null,'https://halfacrebeer.com/pages/balmoral','2026-08-17',6,3,'Hard group-policy trigger at 10.'),
  ('chi_life_on_marz','Life on Marz Community Club','3040 W Armitage Ave, Chicago, IL 60647','Logan Square','Bar / community club',41.9174,-87.7040,
   'active',true,false,'No ordinary reservations for small groups.','First come, first served ordinary public seating.',
   true,null,'unknown','unknown','limited','{afternoon,evening}','{writing,laptop,reading,research,study,sketching,handwork}',true,null,null,21,'21+ evenings',
   'Frequent evening programming — verify the calendar.',null,null,6,2,'Late afternoon and selected evening.'),
  ('chi_marz_mothership','Marz Community Brewing — Mothership','3630 S Iron St, Chicago, IL 60609','McKinley Park','Brewery taproom',41.8281,-87.6552,
   'active',true,true,'Marz does not offer ordinary reservations. Groups of 10 or more are directed into the Host an Event flow.','First come, first served ordinary public seating.',
   true,10,'hard','unknown','limited','{afternoon}','{writing,laptop,reading,research,study,sketching,handwork}',true,null,'Taproom and seasonal beer garden',null,'Minors welcome with an adult 21+',
   'Recurring public programming (Puzzled Pint, trivia, game nights).','https://marzbrewing.com/','2026-08-17',6,3,'Late afternoon only when it does not conflict with programming.'),
  ('chi_waterfront_cafe','Waterfront Café','2800 W Lake Shore Dr, Chicago, IL 60657','Lakefront','Seasonal lakefront café',41.9330,-87.6380,
   'active',true,false,'Seasonal, walk-in only.','First come, first served ordinary public seating.',
   true,null,'unknown','no','unavailable','{morning,afternoon}','{writing,reading,research,study,sketching,handwork}',true,null,'Seasonal outdoor lakefront seating',null,null,
   'Seasonal — closed in cold months.',null,null,6,3,'Seasonal morning/afternoon option.'),
  ('chi_obama_center_cafe','Obama Presidential Center Café','5235 S Cornell Dr, Chicago, IL 60615','Jackson Park','Museum café',41.7930,-87.5860,
   'scout_later',false,false,'Public café seating; no reservations.','First come, first served ordinary public seating.',
   null,null,'unknown','unknown','unknown','{}','{}',true,null,null,null,null,
   'High visitor volume.',null,null,null,null,'Currently too busy for dependable recurring Co-working. Small trial only; excluded from automatic rotation.')
ON CONFLICT (key) DO NOTHING;