
-- ============================================================
-- BLOG POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  slug text NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 1 AND 120),
  excerpt text NOT NULL DEFAULT '' CHECK (char_length(excerpt) <= 320),
  body_markdown text NOT NULL DEFAULT '',
  cover_image_url text NULL,
  cover_image_alt text NULL CHECK (cover_image_alt IS NULL OR char_length(cover_image_alt) <= 240),
  seo_title text NULL CHECK (seo_title IS NULL OR char_length(seo_title) <= 80),
  seo_description text NULL CHECK (seo_description IS NULL OR char_length(seo_description) <= 160),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_name text NOT NULL DEFAULT 'Workshop' CHECK (char_length(author_name) BETWEEN 1 AND 120),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts public read published"
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "blog_posts admin all"
  ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON public.blog_posts (status, published_at DESC);

CREATE TRIGGER tg_blog_posts_updated
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Slug immutability + publish stamping trigger
CREATE OR REPLACE FUNCTION public.tg_blog_posts_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Slug is immutable once the post has ever been published
    IF OLD.published_at IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
      RAISE EXCEPTION 'blog_posts.slug is immutable after publication';
    END IF;
    -- First publish stamps published_at; later edits preserve it
    IF NEW.status = 'published' AND OLD.status = 'draft' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
    IF NEW.status = 'published' AND OLD.status = 'published' THEN
      NEW.published_at := OLD.published_at;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tg_blog_posts_guard
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_blog_posts_guard();

-- ============================================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  status text NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
  source text NOT NULL DEFAULT 'footer' CHECK (char_length(source) <= 40),
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_newsletter_subscribers_email_lower
  ON public.newsletter_subscribers (lower(email));

-- No anon/authenticated grants: only service_role (server functions) touches this table.
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no privileges, so RLS effectively denies all direct access.
