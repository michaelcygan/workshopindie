UPDATE public.group_events e
SET cover_url = v.url
FROM (VALUES
  ('chi_off_color_mousetrap','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Foff-color-mousetrap.jpg'),
  ('chi_goose_island_fulton','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fgoose-island-fulton.jpg'),
  ('chi_cara_cara_club','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fcara-cara-club.jpg'),
  ('chi_half_acre_balmoral','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fhalf-acre-balmoral.jpg'),
  ('chi_begyle_brewing','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fbegyle-brewing.jpg'),
  ('chi_district_brew_yards_west_loop','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fdistrict-brew-yards.jpg'),
  ('chi_marz_mothership','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/venues%2Fmarz-mothership.jpg')
) AS v(key, url)
WHERE e.workshop_venue_key = v.key
  AND e.workshop_event_program_id IS NOT NULL
  AND (e.cover_url IS NULL OR e.cover_url = '');