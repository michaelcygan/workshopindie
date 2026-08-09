-- GENERATED FILE — do not edit by hand.
-- Source of truth: src/lib/taxonomy.ts (rendered by src/lib/taxonomy.sql.ts).
-- Regenerate, then apply as a migration, whenever the taxonomy changes.

CREATE OR REPLACE FUNCTION public.canonical_category(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _value
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'games_tech'
    WHEN 'city' THEN 'city'
    WHEN 'design' THEN 'design'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'games_tech' THEN 'games_tech'
    WHEN 'language' THEN 'language'
    WHEN 'music' THEN 'music'
    WHEN 'other' THEN 'other'
    WHEN 'performance' THEN 'performance'
    WHEN 'scene_life' THEN 'scene_life'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.canonical_from_storage(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _value
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'games_tech'
    WHEN 'design' THEN 'design'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'games_tech' THEN 'games_tech'
    WHEN 'music' THEN 'music'
    WHEN 'performance' THEN 'performance'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    ELSE NULL
  END;
$function$;

CREATE OR REPLACE FUNCTION public.medium_to_canonical(_medium text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE _medium
    WHEN 'animation' THEN 'film_video'
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'games_tech'
    WHEN 'ceramics' THEN 'visual_art'
    WHEN 'code' THEN 'games_tech'
    WHEN 'comics' THEN 'visual_art'
    WHEN 'design' THEN 'design'
    WHEN 'dj' THEN 'music'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'game-design' THEN 'games_tech'
    WHEN 'games_tech' THEN 'games_tech'
    WHEN 'illustration' THEN 'visual_art'
    WHEN 'journalism' THEN 'writing'
    WHEN 'music' THEN 'music'
    WHEN 'painting' THEN 'visual_art'
    WHEN 'performance' THEN 'performance'
    WHEN 'photography' THEN 'visual_art'
    WHEN 'photography-analog' THEN 'visual_art'
    WHEN 'poetry' THEN 'writing'
    WHEN 'printmaking' THEN 'visual_art'
    WHEN 'production' THEN 'music'
    WHEN 'sculpture' THEN 'visual_art'
    WHEN 'songwriting' THEN 'music'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    ELSE NULL
  END;
$function$;
