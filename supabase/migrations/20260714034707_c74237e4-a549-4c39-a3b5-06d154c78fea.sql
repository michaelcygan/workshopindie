
-- Multi-category support: add categories array on works, collab_posts, workshops.
-- Reuses the existing `category` enum. The scalar `category` column remains the
-- "primary" (drives cover color, filters, share card) and is always included
-- in the `categories` array.

ALTER TABLE public.works        ADD COLUMN IF NOT EXISTS categories category[] NOT NULL DEFAULT '{}';
ALTER TABLE public.collab_posts ADD COLUMN IF NOT EXISTS categories category[] NOT NULL DEFAULT '{}';
ALTER TABLE public.workshops    ADD COLUMN IF NOT EXISTS categories category[] NOT NULL DEFAULT '{}';

-- Backfill from the existing scalar category so every row has its current value.
UPDATE public.works        SET categories = ARRAY[category] WHERE (categories IS NULL OR array_length(categories, 1) IS NULL) AND category IS NOT NULL;
UPDATE public.collab_posts SET categories = ARRAY[category] WHERE (categories IS NULL OR array_length(categories, 1) IS NULL) AND category IS NOT NULL;
UPDATE public.workshops    SET categories = ARRAY[category] WHERE (categories IS NULL OR array_length(categories, 1) IS NULL) AND category IS NOT NULL;

-- GIN indexes for fast "categories && ARRAY[...]" / "categories @> ARRAY[...]".
CREATE INDEX IF NOT EXISTS works_categories_gin_idx        ON public.works        USING gin (categories);
CREATE INDEX IF NOT EXISTS collab_posts_categories_gin_idx ON public.collab_posts USING gin (categories);
CREATE INDEX IF NOT EXISTS workshops_categories_gin_idx    ON public.workshops    USING gin (categories);

-- Validation trigger: only Work-eligible categories allowed, dedupe, cap at 3,
-- ensure the primary scalar `category` is always in the array. If the array is
-- empty on write, seed it with the primary.
CREATE OR REPLACE FUNCTION public.tg_normalize_categories_array()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  allowed category[] := ARRAY['film','music','writing','writing_book','build','visual']::category[];
  cleaned category[] := '{}'::category[];
  c category;
BEGIN
  IF NEW.categories IS NULL THEN
    NEW.categories := '{}'::category[];
  END IF;

  -- Dedupe + allowlist filter, preserving first-seen order.
  FOREACH c IN ARRAY NEW.categories LOOP
    IF c = ANY(allowed) AND NOT (c = ANY(cleaned)) THEN
      cleaned := cleaned || c;
    END IF;
    EXIT WHEN array_length(cleaned, 1) >= 3;
  END LOOP;

  -- Ensure primary scalar category is present in the array.
  IF NEW.category IS NOT NULL AND NEW.category = ANY(allowed) AND NOT (NEW.category = ANY(cleaned)) THEN
    -- Put primary first
    cleaned := ARRAY[NEW.category] || cleaned;
    IF array_length(cleaned, 1) > 3 THEN
      cleaned := cleaned[1:3];
    END IF;
  END IF;

  -- If array empty but scalar set, seed with primary.
  IF (cleaned IS NULL OR array_length(cleaned, 1) IS NULL) AND NEW.category IS NOT NULL THEN
    cleaned := ARRAY[NEW.category]::category[];
  END IF;

  NEW.categories := cleaned;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS works_categories_normalize        ON public.works;
DROP TRIGGER IF EXISTS collab_posts_categories_normalize ON public.collab_posts;
DROP TRIGGER IF EXISTS workshops_categories_normalize    ON public.workshops;

CREATE TRIGGER works_categories_normalize
  BEFORE INSERT OR UPDATE ON public.works
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_categories_array();

CREATE TRIGGER collab_posts_categories_normalize
  BEFORE INSERT OR UPDATE ON public.collab_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_categories_array();

CREATE TRIGGER workshops_categories_normalize
  BEFORE INSERT OR UPDATE ON public.workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_categories_array();
