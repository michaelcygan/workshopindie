
-- 1. Table
CREATE TABLE public.blog_post_authors (
  blog_post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  role_label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blog_post_id, profile_id),
  CONSTRAINT blog_post_authors_role_label_check CHECK (role_label IS NULL OR char_length(role_label) <= 60)
);

CREATE INDEX blog_post_authors_profile_idx ON public.blog_post_authors(profile_id, sort_order);
CREATE INDEX blog_post_authors_post_idx ON public.blog_post_authors(blog_post_id, sort_order);

-- 2. Grants
GRANT SELECT ON public.blog_post_authors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_post_authors TO authenticated;
GRANT ALL ON public.blog_post_authors TO service_role;

-- 3. RLS
ALTER TABLE public.blog_post_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_post_authors public read published"
  ON public.blog_post_authors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.blog_posts p
      WHERE p.id = blog_post_authors.blog_post_id
        AND p.status = 'published'
        AND p.published_at IS NOT NULL
        AND p.published_at <= now()
    )
  );

CREATE POLICY "blog_post_authors admin all"
  ON public.blog_post_authors
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Helper: count of published, non-future posts attributed to a profile.
CREATE OR REPLACE FUNCTION public.profile_published_blog_count(_profile_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.blog_post_authors a
  JOIN public.blog_posts p ON p.id = a.blog_post_id
  WHERE a.profile_id = _profile_id
    AND p.status = 'published'
    AND p.published_at IS NOT NULL
    AND p.published_at <= now();
$$;

GRANT EXECUTE ON FUNCTION public.profile_published_blog_count(uuid) TO anon, authenticated, service_role;

-- 5. Backfill from existing author_profile_id
INSERT INTO public.blog_post_authors (blog_post_id, profile_id, sort_order)
SELECT p.id, p.author_profile_id, 0
FROM public.blog_posts p
WHERE p.author_profile_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6. Fallback: posts authored by "Michael Cygan" name-only, attribute to michaelcygan
INSERT INTO public.blog_post_authors (blog_post_id, profile_id, sort_order)
SELECT p.id, prof.id, 0
FROM public.blog_posts p
CROSS JOIN LATERAL (
  SELECT id FROM public.profiles WHERE username = 'michaelcygan' LIMIT 1
) prof
WHERE p.author_name ILIKE 'Michael Cygan'
ON CONFLICT DO NOTHING;
