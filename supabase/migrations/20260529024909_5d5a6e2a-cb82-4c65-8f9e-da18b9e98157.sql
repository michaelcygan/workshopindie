ALTER TABLE public.workshops
  ADD COLUMN IF NOT EXISTS audience_city_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.collab_posts
  ADD COLUMN IF NOT EXISTS rights_arrangement text;

ALTER TABLE public.collab_posts
  DROP CONSTRAINT IF EXISTS collab_posts_rights_arrangement_check;

ALTER TABLE public.collab_posts
  ADD CONSTRAINT collab_posts_rights_arrangement_check
  CHECK (rights_arrangement IS NULL OR rights_arrangement IN ('owner_retains','equal_split','creative_commons'));