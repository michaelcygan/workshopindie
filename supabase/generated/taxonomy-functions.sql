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
    WHEN 'architecture_cities' THEN 'architecture_cities'
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'software_ai'
    WHEN 'city' THEN 'city'
    WHEN 'design' THEN 'design'
    WHEN 'environment_nature' THEN 'environment_nature'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'games_tech' THEN 'software_ai'
    WHEN 'journalism_media' THEN 'journalism_media'
    WHEN 'language' THEN 'language'
    WHEN 'making_engineering' THEN 'making_engineering'
    WHEN 'music' THEN 'music'
    WHEN 'other' THEN 'other'
    WHEN 'performance' THEN 'performance'
    WHEN 'scene_life' THEN 'scene_life'
    WHEN 'science_research' THEN 'science_research'
    WHEN 'software_ai' THEN 'software_ai'
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
    WHEN 'architecture_cities' THEN 'architecture_cities'
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'software_ai'
    WHEN 'design' THEN 'design'
    WHEN 'environment_nature' THEN 'environment_nature'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'games_tech' THEN 'software_ai'
    WHEN 'journalism_media' THEN 'journalism_media'
    WHEN 'making_engineering' THEN 'making_engineering'
    WHEN 'music' THEN 'music'
    WHEN 'performance' THEN 'performance'
    WHEN 'science_research' THEN 'science_research'
    WHEN 'software_ai' THEN 'software_ai'
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
    WHEN 'architecture_cities' THEN 'architecture_cities'
    WHEN 'audio' THEN 'audio'
    WHEN 'build' THEN 'software_ai'
    WHEN 'ceramics' THEN 'visual_art'
    WHEN 'code' THEN 'software_ai'
    WHEN 'comics' THEN 'visual_art'
    WHEN 'design' THEN 'design'
    WHEN 'dj' THEN 'music'
    WHEN 'environment_nature' THEN 'environment_nature'
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'game-design' THEN 'software_ai'
    WHEN 'games_tech' THEN 'software_ai'
    WHEN 'illustration' THEN 'visual_art'
    WHEN 'journalism' THEN 'journalism_media'
    WHEN 'journalism_media' THEN 'journalism_media'
    WHEN 'making_engineering' THEN 'making_engineering'
    WHEN 'music' THEN 'music'
    WHEN 'painting' THEN 'visual_art'
    WHEN 'performance' THEN 'performance'
    WHEN 'photography' THEN 'visual_art'
    WHEN 'photography-analog' THEN 'visual_art'
    WHEN 'poetry' THEN 'writing'
    WHEN 'printmaking' THEN 'visual_art'
    WHEN 'production' THEN 'music'
    WHEN 'science_research' THEN 'science_research'
    WHEN 'sculpture' THEN 'visual_art'
    WHEN 'software_ai' THEN 'software_ai'
    WHEN 'songwriting' THEN 'music'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    ELSE NULL
  END;
$function$;
