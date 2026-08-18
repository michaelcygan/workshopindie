INSERT INTO public.workshop_event_programs (
  key, program_type, name, group_id, active, timezone,
  events_per_month, target_future_occurrences, min_lead_days, duration_minutes,
  home_base_venue_key, venue_config, schedule_windows, template, created_by
)
SELECT
  'writing_coworking',
  'writing_coworking',
  'Workshop Writing Co-working',
  p.group_id,
  true,
  'America/Chicago',
  4, 8, 7, 180,
  NULL,
  '{
    "chi_begyle_brewing": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [1,2,3,4,5,6,0], "needs_review": false},
    "chi_long_room": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [1,2,3,4,5,6,0], "needs_review": false},
    "chi_off_color_mousetrap": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [1,2,3,4,5,6,0], "needs_review": false},
    "chi_goose_island_fulton": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [3,4,5,6,0], "needs_review": false},
    "chi_half_acre_balmoral": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [1,2,3,4,5,6,0], "needs_review": false},
    "chi_marz_mothership": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [3,4,5,6,0], "needs_review": false},
    "chi_life_on_marz": {"enabled": true, "capacity": 6, "overflow": 2, "min_age": 21, "weekdays": [3,4,5,6,0], "needs_review": false},
    "chi_waterfront_cafe": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [1,2,3,4,5,6,0], "needs_review": false},
    "chi_district_brew_yards_west_loop": {"enabled": true, "capacity": 6, "overflow": 2, "min_age": 21, "weekdays": [3,4,5,6,0], "needs_review": false},
    "chi_solemn_oath_still_life": {"enabled": true, "capacity": 6, "overflow": 2, "weekdays": [3,4,5], "needs_review": true}
  }'::jsonb,
  '[]'::jsonb,
  '{
    "kind": "coworking",
    "title": "Workshop Writing Co-working",
    "creative_category": "writing",
    "format": "in_person",
    "source": "workshop",
    "is_official": true,
    "visibility": "public",
    "rsvp_mode": "open",
    "facilitation": "hostless",
    "drop_in_allowed": true,
    "waitlist_enabled": true,
    "allowed_activities": ["writing"],
    "tagline": "Bring something to write. Work quietly alongside other writers.",
    "description": "A quiet, small-group writing session. Bring a notebook, laptop, draft, research notes, or an unfinished idea. Write independently alongside other writers. There is no critique, reading, presentation, or required conversation. Drop in, find the group, buy something from the venue, and work for as long as you like."
  }'::jsonb,
  p.created_by
FROM public.workshop_event_programs p
WHERE p.key = 'open_house_chicago'
ON CONFLICT (key) DO NOTHING;