-- Structured timeline + multi-city support on collab_posts

DO $$ BEGIN
  CREATE TYPE public.timeline_mode AS ENUM ('asap','by_date','window','ongoing','flexible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS timeline_mode public.timeline_mode NOT NULL DEFAULT 'flexible',
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS also_cities uuid[] NOT NULL DEFAULT '{}';

-- Sanity: end >= start when both present
ALTER TABLE public.collab_posts
  DROP CONSTRAINT IF EXISTS collab_posts_timeline_window_chk;
ALTER TABLE public.collab_posts
  ADD CONSTRAINT collab_posts_timeline_window_chk
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on);

-- Cap also_cities array length at 4
ALTER TABLE public.collab_posts
  DROP CONSTRAINT IF EXISTS collab_posts_also_cities_len_chk;
ALTER TABLE public.collab_posts
  ADD CONSTRAINT collab_posts_also_cities_len_chk
  CHECK (array_length(also_cities, 1) IS NULL OR array_length(also_cities, 1) <= 4);

CREATE INDEX IF NOT EXISTS collab_posts_starts_on_idx
  ON public.collab_posts (starts_on)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS collab_posts_also_cities_gin
  ON public.collab_posts USING GIN (also_cities);
