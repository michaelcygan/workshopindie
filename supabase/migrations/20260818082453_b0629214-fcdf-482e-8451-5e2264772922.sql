CREATE TABLE public.workshop_event_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  program_type text NOT NULL DEFAULT 'open_house',
  name text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'UTC',
  events_per_month integer NOT NULL DEFAULT 4,
  target_future_occurrences integer NOT NULL DEFAULT 8,
  min_lead_days integer NOT NULL DEFAULT 7,
  duration_minutes integer NOT NULL DEFAULT 150,
  home_base_venue_key text,
  venue_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_materialized_at timestamptz,
  last_error text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_event_programs TO authenticated;
GRANT ALL ON public.workshop_event_programs TO service_role;

ALTER TABLE public.workshop_event_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage workshop event programs"
ON public.workshop_event_programs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_workshop_event_programs_updated_at
BEFORE UPDATE ON public.workshop_event_programs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.group_events
  ADD COLUMN workshop_event_program_id uuid REFERENCES public.workshop_event_programs(id) ON DELETE SET NULL,
  ADD COLUMN program_occurrence_key text;

CREATE UNIQUE INDEX group_events_program_occurrence_key_uidx
  ON public.group_events (program_occurrence_key)
  WHERE program_occurrence_key IS NOT NULL;

CREATE INDEX group_events_workshop_event_program_id_idx
  ON public.group_events (workshop_event_program_id)
  WHERE workshop_event_program_id IS NOT NULL;

INSERT INTO public.workshop_event_programs (
  key, program_type, name, group_id, active, timezone,
  events_per_month, target_future_occurrences, min_lead_days, duration_minutes,
  home_base_venue_key, venue_config, schedule_windows, template
)
SELECT
  'open_house_chicago',
  'open_house',
  'Workshop Open House — Chicago',
  g.id,
  true,
  'America/Chicago',
  4, 8, 7, 150,
  'chi_off_color_mousetrap',
  '{
    "chi_off_color_mousetrap": {"enabled": true, "capacity": 10, "overflow": 5, "needs_review": false, "weekdays": [1,2,3,4,5,6,0]},
    "chi_goose_island_fulton": {"enabled": true, "capacity": 10, "overflow": 5, "needs_review": false, "weekdays": [3,4,5,6,0]},
    "chi_cara_cara_club": {"enabled": true, "capacity": 10, "overflow": 5, "needs_review": false, "weekdays": [1,2,3,4,5,6,0], "min_age": 21},
    "chi_half_acre_balmoral": {"enabled": true, "capacity": 6, "overflow": 3, "needs_review": false, "weekdays": [1,2,3,4,5,6,0]},
    "chi_solemn_oath_still_life": {"enabled": true, "capacity": 6, "overflow": 2, "needs_review": true, "weekdays": [3,4,5]},
    "chi_begyle_brewing": {"enabled": true, "capacity": 8, "overflow": 4, "needs_review": false, "weekdays": [1,2,3,4,5,6,0]},
    "chi_district_brew_yards_west_loop": {"enabled": true, "capacity": 10, "overflow": 5, "needs_review": false, "weekdays": [3,4,5,6,0]},
    "chi_marz_mothership": {"enabled": true, "capacity": 6, "overflow": 3, "needs_review": false, "weekdays": [3,4,5,6,0]}
  }'::jsonb,
  '[
    {"id": "wk_evening_630", "kind": "evening", "weekdays": [2,3,4], "hour": 18, "minute": 30},
    {"id": "wk_evening_700", "kind": "evening", "weekdays": [1,2,3,4], "hour": 19, "minute": 0},
    {"id": "wk_evening_630_thu", "kind": "evening", "weekdays": [4,5], "hour": 18, "minute": 30},
    {"id": "we_afternoon_200", "kind": "weekend_afternoon", "weekdays": [6,0], "hour": 14, "minute": 0},
    {"id": "we_afternoon_300", "kind": "weekend_afternoon", "weekdays": [6,0], "hour": 15, "minute": 0}
  ]'::jsonb,
  '{
    "title": "Workshop Open House",
    "tagline": "Drop in, meet the Chicago Workshop room.",
    "kind": "networking",
    "format": "in_person",
    "visibility": "public",
    "rsvp_mode": "open",
    "is_official": true,
    "source": "workshop",
    "facilitation": "hostless",
    "drop_in_allowed": true,
    "waitlist_enabled": true
  }'::jsonb
FROM public.groups g
WHERE g.slug = 'chicago'
ON CONFLICT (key) DO NOTHING;