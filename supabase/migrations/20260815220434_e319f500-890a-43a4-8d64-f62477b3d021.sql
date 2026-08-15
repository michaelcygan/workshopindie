ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS blog_posts_subjects_gin ON public.blog_posts USING gin (subjects);