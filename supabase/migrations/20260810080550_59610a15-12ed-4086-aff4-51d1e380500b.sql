ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS story_type text;

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_story_type_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_story_type_check
  CHECK (story_type IS NULL OR story_type IN ('essay','report','tutorial','interview','news','research_note','journal'));

COMMENT ON COLUMN public.blog_posts.story_type IS 'Editorial kind of piece (essay, report, tutorial, ...). Separate dimension from public.blog_posts.fields, which describes subject area.';