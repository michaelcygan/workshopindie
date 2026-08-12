ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS story_types text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.blog_posts
  SET story_types = ARRAY[story_type]
  WHERE story_type IS NOT NULL AND cardinality(story_types) = 0;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_story_types_max CHECK (cardinality(story_types) <= 3);