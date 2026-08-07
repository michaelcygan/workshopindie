-- Wave 9, step 3: canonical category storage alongside the legacy enum.
-- Nothing is dropped; the legacy columns remain the write path and a trigger
-- keeps the canonical column in lockstep.

CREATE OR REPLACE FUNCTION public.canonical_category(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _value
    WHEN 'film' THEN 'film_video'
    WHEN 'film_video' THEN 'film_video'
    WHEN 'visual' THEN 'visual_art'
    WHEN 'visual_art' THEN 'visual_art'
    WHEN 'build' THEN 'games_tech'
    WHEN 'games_tech' THEN 'games_tech'
    WHEN 'writing' THEN 'writing'
    WHEN 'writing_book' THEN 'writing'
    WHEN 'music' THEN 'music'
    WHEN 'performance' THEN 'performance'
    WHEN 'audio' THEN 'audio'
    WHEN 'design' THEN 'design'
    WHEN 'scene_life' THEN 'scene_life'
    WHEN 'city' THEN 'city'
    WHEN 'language' THEN 'language'
    WHEN NULL THEN NULL
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.canonical_category(text) IS
  'Legacy or canonical creative-category value in, canonical id out. Topic values (critique, coworking, ...) return NULL: they are not creative categories.';

-- Scalar columns -----------------------------------------------------------

ALTER TABLE public.works ADD COLUMN IF NOT EXISTS category_canonical text;
ALTER TABLE public.collab_posts ADD COLUMN IF NOT EXISTS category_canonical text;
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS category_canonical text;
ALTER TABLE public.workshop_links ADD COLUMN IF NOT EXISTS category_canonical text;
ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS category_canonical text;
ALTER TABLE public.instant_rooms ADD COLUMN IF NOT EXISTS medium_canonical text;
ALTER TABLE public.standing_meetups ADD COLUMN IF NOT EXISTS default_category_canonical text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS categories_canonical text[] NOT NULL DEFAULT '{}';

-- Generic sync trigger: TG_ARGV[0] = source column, TG_ARGV[1] = target.
CREATE OR REPLACE FUNCTION public.tg_sync_canonical_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  j jsonb := to_jsonb(NEW);
BEGIN
  NEW := jsonb_populate_record(
    NEW,
    jsonb_build_object(TG_ARGV[1], public.canonical_category(j ->> TG_ARGV[0]))
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_canonical_categories_array()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.categories_canonical := COALESCE(
    (
      SELECT array_agg(DISTINCT c ORDER BY c)
      FROM (
        SELECT public.canonical_category(v::text) AS c
        FROM unnest(COALESCE(NEW.categories, '{}'::category[])) AS v
      ) s
      WHERE c IS NOT NULL
    ),
    '{}'::text[]
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS works_sync_canonical_category ON public.works;
CREATE TRIGGER works_sync_canonical_category
  BEFORE INSERT OR UPDATE OF category ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('category', 'category_canonical');

DROP TRIGGER IF EXISTS collab_posts_sync_canonical_category ON public.collab_posts;
CREATE TRIGGER collab_posts_sync_canonical_category
  BEFORE INSERT OR UPDATE OF category ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('category', 'category_canonical');

DROP TRIGGER IF EXISTS workshops_sync_canonical_category ON public.workshops;
CREATE TRIGGER workshops_sync_canonical_category
  BEFORE INSERT OR UPDATE OF category ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('category', 'category_canonical');

DROP TRIGGER IF EXISTS workshop_links_sync_canonical_category ON public.workshop_links;
CREATE TRIGGER workshop_links_sync_canonical_category
  BEFORE INSERT OR UPDATE OF category ON public.workshop_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('category', 'category_canonical');

DROP TRIGGER IF EXISTS instant_rooms_sync_canonical_category ON public.instant_rooms;
CREATE TRIGGER instant_rooms_sync_canonical_category
  BEFORE INSERT OR UPDATE OF category ON public.instant_rooms
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('category', 'category_canonical');

DROP TRIGGER IF EXISTS instant_rooms_sync_canonical_medium ON public.instant_rooms;
CREATE TRIGGER instant_rooms_sync_canonical_medium
  BEFORE INSERT OR UPDATE OF medium ON public.instant_rooms
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('medium', 'medium_canonical');

DROP TRIGGER IF EXISTS standing_meetups_sync_canonical_category ON public.standing_meetups;
CREATE TRIGGER standing_meetups_sync_canonical_category
  BEFORE INSERT OR UPDATE OF default_category ON public.standing_meetups
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category('default_category', 'default_category_canonical');

DROP TRIGGER IF EXISTS profiles_sync_canonical_categories ON public.profiles;
CREATE TRIGGER profiles_sync_canonical_categories
  BEFORE INSERT OR UPDATE OF categories ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_categories_array();

-- Backfill ------------------------------------------------------------------

UPDATE public.works SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IS DISTINCT FROM public.canonical_category(category::text);
UPDATE public.collab_posts SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IS DISTINCT FROM public.canonical_category(category::text);
UPDATE public.workshops SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IS DISTINCT FROM public.canonical_category(category::text);
UPDATE public.workshop_links SET category_canonical = public.canonical_category(category::text)
  WHERE category_canonical IS DISTINCT FROM public.canonical_category(category::text);
UPDATE public.instant_rooms SET
    category_canonical = public.canonical_category(category::text),
    medium_canonical = public.canonical_category(medium::text)
  WHERE category_canonical IS DISTINCT FROM public.canonical_category(category::text)
     OR medium_canonical IS DISTINCT FROM public.canonical_category(medium::text);
UPDATE public.standing_meetups SET default_category_canonical = public.canonical_category(default_category::text)
  WHERE default_category_canonical IS DISTINCT FROM public.canonical_category(default_category::text);

UPDATE public.profiles p SET categories_canonical = COALESCE(
  (
    SELECT array_agg(DISTINCT c ORDER BY c)
    FROM (
      SELECT public.canonical_category(v::text) AS c
      FROM unnest(COALESCE(p.categories, '{}'::category[])) AS v
    ) s
    WHERE c IS NOT NULL
  ),
  '{}'::text[]
);

-- Indexes for the reads that will move over in step 4.
CREATE INDEX IF NOT EXISTS works_category_canonical_idx ON public.works (category_canonical);
CREATE INDEX IF NOT EXISTS collab_posts_category_canonical_idx ON public.collab_posts (category_canonical);
CREATE INDEX IF NOT EXISTS profiles_categories_canonical_idx ON public.profiles USING gin (categories_canonical);