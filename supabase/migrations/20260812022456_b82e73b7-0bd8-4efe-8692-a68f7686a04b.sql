DO $$
DECLARE
  base text := 'https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2F';
  m jsonb := '{
    "chi_eli_tea_art_craft_night": "eli-tea-craft.jpg",
    "chi_eli_tea_open_mic_friday": "eli-tea-openmic.jpg",
    "chi_eli_tea_writers_group": "eli-tea-writers.jpg",
    "chi_platform_studios_figure_drawing_thu": "platform-studios-figure-drawing.jpg",
    "chi_platform_studios_figure_drawing_wed": "platform-studios-figure-drawing.jpg",
    "chi_fullers_pub_open_mic_thu": "fullers-pub.jpg",
    "chi_fullers_pub_open_mic_wed": "fullers-pub.jpg",
    "chi_chi_hack_night": "chi-hack-night.jpg",
    "chi_south_side_hackerspace_open_house": "south-side-hackerspace.jpg",
    "chi_do_not_submit_lakeview": "do-not-submit-lakeview.jpg",
    "chi_do_not_submit_andersonville": "do-not-submit-andersonville.jpg",
    "chi_chipy_main_meeting": "chipy-main-meeting.jpg",
    "chi_digital_delivery_chicago": "digital-delivery-chicago.jpg",
    "chi_aiga_coworking_days": "aiga-coworking.jpg",
    "chi_aiga_coffee_and_crits": "aiga-coffee-and-crits.jpg",
    "chi_story_lab_chicago": "story-lab-chicago.jpg",
    "chi_unabridged_queer_book_club": "unabridged-queer-book-club.jpg",
    "chi_south_side_zine_fest": "south-side-zine-fest.jpg",
    "chi_read_and_run_wild_mile": "wild-mile.jpg",
    "chi_read_and_run_fine_arts_building": "fine-arts-building.jpg"
  }'::jsonb;
  k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(m) LOOP
    UPDATE public.group_events
       SET cover_url = base || (m ->> k),
           updated_at = now()
     WHERE series_key = k
       AND cover_url IS NULL;
  END LOOP;
END $$;