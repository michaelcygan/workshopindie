WITH covers(series_key, cover_url, credit_name, credit_url) AS (
  VALUES
    ('chi_group_312_films_annual_report','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fgroup-312-films.jpg','Group 312 Films','https://chicagofilmmakers.org/upcoming-screenings-and-events/group-312-films-2026-annual-report'),
    ('chi_light_painting_workshop_fall_2026','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Flight-painting-workshop.jpg','Chicago Photography Classes','https://chicagophotoclasses.com/product/light-painting-workshop/'),
    ('chi_indie_game_showcase_2026','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Findie-city-games-showcase.jpg','Indie City Games','https://indiecitygames.org/calendar/cigs-2026'),
    ('chi_jarvis_squear_open_mic','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fjarvis-square-tavern.jpg','Jarvis Square Tavern','https://jarvissquaretavern.com/js-events/'),
    ('chi_infinite_wrench_fri','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_infinite_wrench_sat','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_infinite_wrench_sun','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_paper_machete','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fpaper-machete.jpg','The Paper Machete','https://thepapermachete.org/'),
    ('chi_test_literary_series','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Ftest-literary-series.jpg','TEST Literary Series','https://whistlerchicago.com/events/test-literary-series-aug-2026'),
    ('chi_songwriters_collective_brig_open_mic','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fsongwriters-collective.jpg','Chicago Songwriters Collective','https://www.meetup.com/vocalists-151/'),
    ('chi_songwriters_collective_song_sharing','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fsongwriters-collective.jpg','Chicago Songwriters Collective','https://www.meetup.com/vocalists-151/'),
    ('chi_po_box_fiber_night','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fpo-box-collective.jpg','PO Box Collective','https://www.poboxcollective.us/'),
    ('chi_po_box_poetry_series','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fpo-box-collective.jpg','PO Box Collective','https://www.poboxcollective.us/'),
    ('chi_this_much_is_true','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fthis-much-is-true.jpg','This Much Is True','https://www.thismuchistruechicago.com/'),
    ('chi_missspoken','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fcoles-bar.jpg','Cole''s Bar','https://www.colesbarchicago.com/')
)
UPDATE public.group_events ge
SET cover_url = c.cover_url,
    photo_credit_name = c.credit_name,
    photo_credit_url = c.credit_url
FROM covers c
WHERE ge.series_key = c.series_key
  AND (ge.cover_url IS NULL OR ge.cover_url = '' OR ge.cover_url IS DISTINCT FROM c.cover_url);

WITH covers(series_key, cover_url, credit_name, credit_url) AS (
  VALUES
    ('chi_jarvis_squear_open_mic','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fjarvis-square-tavern.jpg','Jarvis Square Tavern','https://jarvissquaretavern.com/js-events/'),
    ('chi_infinite_wrench_fri','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_infinite_wrench_sat','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_infinite_wrench_sun','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fneo-futurists-infinite-wrench.jpg','The Neo-Futurists','https://neofuturists.org/events/theinfinitewrench/'),
    ('chi_po_box_fiber_night','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fpo-box-collective.jpg','PO Box Collective','https://www.poboxcollective.us/'),
    ('chi_missspoken','https://avxpquzarafxhxuojmjs.supabase.co/storage/v1/object/public/covers/events%2Fchicago%2Fcoles-bar.jpg','Cole''s Bar','https://www.colesbarchicago.com/')
)
UPDATE public.event_series es
SET template = es.template
  || jsonb_build_object(
       'cover_url', c.cover_url,
       'photo_credit_name', c.credit_name,
       'photo_credit_url', c.credit_url
     )
FROM covers c
WHERE es.series_key = c.series_key;