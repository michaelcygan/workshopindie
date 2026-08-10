-- Wave 1/2: canonical Field vocabulary in the database.
-- Generated mirror of src/lib/taxonomy.ts (supabase/generated/taxonomy-functions.sql).

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

-- 2. Canonical columns become app-writable ---------------------------------
-- Previously these triggers overwrote whatever the app wrote with a value
-- derived from the legacy enum, so a Field the enum cannot express (e.g.
-- software_ai) could never survive a write. They now only fill in a value
-- when the app did not supply one, or when the legacy column changed.

CREATE OR REPLACE FUNCTION public.tg_sync_canonical_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  target_val text := j ->> TG_ARGV[1];
  legacy_val text := j ->> TG_ARGV[0];
  old_target text;
  old_legacy text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_target := to_jsonb(OLD) ->> TG_ARGV[1];
    old_legacy := to_jsonb(OLD) ->> TG_ARGV[0];
    -- The app explicitly set a canonical Field: respect it.
    IF target_val IS DISTINCT FROM old_target AND target_val IS NOT NULL THEN
      RETURN NEW;
    END IF;
    -- Legacy column unchanged and canonical already present: leave it alone.
    IF legacy_val IS NOT DISTINCT FROM old_legacy AND target_val IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSIF target_val IS NOT NULL THEN
    RETURN NEW;
  END IF;

  NEW := jsonb_populate_record(
    NEW,
    jsonb_build_object(TG_ARGV[1], public.canonical_category(legacy_val))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_canonical_category_array()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
  target_val text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(j -> TG_ARGV[1], '[]'::jsonb)));
  legacy_val text[] := ARRAY(SELECT jsonb_array_elements_text(COALESCE(j -> TG_ARGV[0], '[]'::jsonb)));
  old_target text[];
  old_legacy text[];
  derived text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    old_target := ARRAY(SELECT jsonb_array_elements_text(COALESCE(to_jsonb(OLD) -> TG_ARGV[1], '[]'::jsonb)));
    old_legacy := ARRAY(SELECT jsonb_array_elements_text(COALESCE(to_jsonb(OLD) -> TG_ARGV[0], '[]'::jsonb)));
    IF target_val IS DISTINCT FROM old_target AND cardinality(target_val) > 0 THEN
      RETURN NEW;
    END IF;
    IF legacy_val IS NOT DISTINCT FROM old_legacy AND cardinality(target_val) > 0 THEN
      RETURN NEW;
    END IF;
  ELSIF cardinality(target_val) > 0 THEN
    RETURN NEW;
  END IF;

  derived := COALESCE((
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (SELECT public.canonical_category(v) AS c FROM unnest(legacy_val) AS v) s
    WHERE c IS NOT NULL
  ), '{}'::text[]);

  NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[1], to_jsonb(derived)));
  RETURN NEW;
END;
$$;

-- 3. Missing canonical Field storage ---------------------------------------

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS fields text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS blog_posts_fields_idx ON public.blog_posts USING gin (fields);
CREATE INDEX IF NOT EXISTS groups_fields_idx ON public.groups USING gin (fields);

COMMENT ON COLUMN public.blog_posts.fields IS
  'Canonical Field ids (src/lib/taxonomy.ts FIELD_IDS). Authoritative; category_slug is legacy compatibility for old posts and /blog/c/* URLs.';
COMMENT ON COLUMN public.groups.fields IS
  'Canonical Field ids (src/lib/taxonomy.ts FIELD_IDS). Authoritative; category / taxonomy_key are legacy compatibility.';

-- Events accept the full Field vocabulary.
ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_creative_category_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_creative_category_check
  CHECK (creative_category IS NULL OR creative_category = ANY (ARRAY[
    'music','film_video','writing','visual_art','design','performance',
    'journalism_media','software_ai','making_engineering','science_research',
    'architecture_cities','environment_nature','other',
    -- legacy, still stored on old rows
    'games_tech','audio'
  ]));

-- 4. Retire Games & Tech as a canonical Field ------------------------------
-- The system Group keeps its slug (URLs unchanged) and gains the modern key.
ALTER TABLE public.groups DISABLE TRIGGER trg_protect_system_groups;
UPDATE public.groups
   SET taxonomy_key = 'software_ai',
       name = 'Software & AI'
 WHERE system_type = 'medium' AND taxonomy_key = 'games_tech';
ALTER TABLE public.groups ENABLE TRIGGER trg_protect_system_groups;

UPDATE public.group_events SET creative_category = 'software_ai' WHERE creative_category = 'games_tech';

-- 5. Backfill canonical values under the new vocabulary --------------------
UPDATE public.works SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IN ('games_tech');
UPDATE public.collab_posts SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IN ('games_tech');
UPDATE public.workshops SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IN ('games_tech');
UPDATE public.workshop_links SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IN ('games_tech');
UPDATE public.instant_rooms SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IN ('games_tech');
UPDATE public.instant_rooms SET medium_canonical = public.canonical_category(medium::text)
  WHERE medium_canonical IN ('games_tech');
UPDATE public.standing_meetups SET default_category_canonical = public.canonical_category(default_category::text)
  WHERE default_category_canonical IN ('games_tech');

UPDATE public.works w SET categories_canonical = COALESCE((
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(w.categories, '{}'::category[])) AS v) s
    WHERE c IS NOT NULL), '{}'::text[])
  WHERE 'games_tech' = ANY (w.categories_canonical);

UPDATE public.collab_posts cp SET categories_canonical = COALESCE((
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(cp.categories, '{}'::category[])) AS v) s
    WHERE c IS NOT NULL), '{}'::text[])
  WHERE 'games_tech' = ANY (cp.categories_canonical);

UPDATE public.profiles p SET categories_canonical = COALESCE((
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(p.categories, '{}'::category[])) AS v) s
    WHERE c IS NOT NULL), '{}'::text[])
  WHERE 'games_tech' = ANY (p.categories_canonical);

-- Seed Fields for existing blog posts and groups from their legacy values.
UPDATE public.blog_posts SET fields = ARRAY[public.canonical_category(replace(category_slug, '-', '_'))]
  WHERE cardinality(fields) = 0
    AND public.canonical_category(replace(category_slug, '-', '_')) IS NOT NULL;

UPDATE public.groups SET fields = ARRAY[COALESCE(taxonomy_key, public.canonical_category(category::text))]
  WHERE cardinality(fields) = 0
    AND COALESCE(taxonomy_key, public.canonical_category(category::text)) IS NOT NULL;