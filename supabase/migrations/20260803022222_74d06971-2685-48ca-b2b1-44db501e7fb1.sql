ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS blog_posts_featured_published_idx
  ON public.blog_posts (featured, published_at DESC);