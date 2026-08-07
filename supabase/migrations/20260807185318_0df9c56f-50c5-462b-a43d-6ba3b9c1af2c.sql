-- Wave 9, step 3b: canonical arrays for the multi-category columns the
-- browse/filter queries actually use.

-- Generic array sync: TG_ARGV[0] = source array column, TG_ARGV[1] = target.
CREATE OR REPLACE FUNCTION public.tg_sync_canonical_category_array()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  src jsonb := COALESCE(to_jsonb(NEW) -> TG_ARGV[0], '[]'::jsonb);
  out_vals text[];
BEGIN
  IF jsonb_typeof(src) <> 'array' THEN
    src := '[]'::jsonb;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT s.c ORDER BY s.c), '{}'::text[])
    INTO out_vals
    FROM (
      SELECT public.canonical_category(x) AS c
      FROM jsonb_array_elements_text(src) AS x
    ) s
   WHERE s.c IS NOT NULL;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[1], to_jsonb(out_vals)));
  RETURN NEW;
END;
$$;

ALTER TABLE public.works ADD COLUMN IF NOT EXISTS categories_canonical text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.collab_posts ADD COLUMN IF NOT EXISTS categories_canonical text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS categories_canonical text[] NOT NULL DEFAULT '{}';

DROP TRIGGER IF EXISTS works_sync_canonical_categories ON public.works;
CREATE TRIGGER works_sync_canonical_categories
  BEFORE INSERT OR UPDATE OF categories ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category_array('categories', 'categories_canonical');

DROP TRIGGER IF EXISTS collab_posts_sync_canonical_categories ON public.collab_posts;
CREATE TRIGGER collab_posts_sync_canonical_categories
  BEFORE INSERT OR UPDATE OF categories ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category_array('categories', 'categories_canonical');

DROP TRIGGER IF EXISTS workshops_sync_canonical_categories ON public.workshops;
CREATE TRIGGER workshops_sync_canonical_categories
  BEFORE INSERT OR UPDATE OF categories ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category_array('categories', 'categories_canonical');

-- Reuse the generic array trigger for profiles too, then retire the bespoke one.
DROP TRIGGER IF EXISTS profiles_sync_canonical_categories ON public.profiles;
CREATE TRIGGER profiles_sync_canonical_categories
  BEFORE INSERT OR UPDATE OF categories ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_canonical_category_array('categories', 'categories_canonical');
DROP FUNCTION IF EXISTS public.tg_sync_canonical_categories_array();

-- Backfill
UPDATE public.works w SET categories_canonical = COALESCE((
  SELECT array_agg(DISTINCT c ORDER BY c) FROM (
    SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(w.categories, '{}'::category[])) AS v
  ) s WHERE c IS NOT NULL), '{}'::text[]);

UPDATE public.collab_posts p SET categories_canonical = COALESCE((
  SELECT array_agg(DISTINCT c ORDER BY c) FROM (
    SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(p.categories, '{}'::category[])) AS v
  ) s WHERE c IS NOT NULL), '{}'::text[]);

UPDATE public.workshops k SET categories_canonical = COALESCE((
  SELECT array_agg(DISTINCT c ORDER BY c) FROM (
    SELECT public.canonical_category(v::text) AS c FROM unnest(COALESCE(k.categories, '{}'::category[])) AS v
  ) s WHERE c IS NOT NULL), '{}'::text[]);

CREATE INDEX IF NOT EXISTS works_categories_canonical_idx ON public.works USING gin (categories_canonical);
CREATE INDEX IF NOT EXISTS collab_posts_categories_canonical_idx ON public.collab_posts USING gin (categories_canonical);
CREATE INDEX IF NOT EXISTS workshops_categories_canonical_idx ON public.workshops USING gin (categories_canonical);

-- Expose the canonical list on the public profile view.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, username, display_name, avatar_url, cover_url, city_id, home_city_id,
  headline, bio, artist_statement, categories, mediums, tools,
  external_links, instagram_handle, creator_status, pinned_work_ids, cover_work_id,
  work_count, follower_count, following_count, worked_with_count, aliases,
  discoverable, indexable, hide_group_memberships, event_visibility, show_online,
  dm_policy, preferred_language, onboarded, created_at, updated_at, languages,
  categories_canonical
FROM public.profiles;