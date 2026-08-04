ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category_slug text NOT NULL DEFAULT 'general';

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_slug_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_slug_check
  CHECK (category_slug IN ('general','music','film-video','writing','visual-art','games-tech'));

CREATE INDEX IF NOT EXISTS blog_posts_category_published_idx
  ON public.blog_posts (category_slug, published_at DESC, id DESC)
  WHERE status = 'published' AND show_in_blog_index = true;

WITH work_cat AS (
  SELECT t.blog_post_id,
         CASE w.category::text
           WHEN 'music' THEN 'music'
           WHEN 'film' THEN 'film-video'
           WHEN 'writing' THEN 'writing'
           WHEN 'writing_book' THEN 'writing'
           WHEN 'visual' THEN 'visual-art'
           WHEN 'build' THEN 'games-tech'
           ELSE NULL
         END AS slug
  FROM public.blog_post_entity_tags t
  JOIN public.works w ON w.id = t.work_id
  WHERE t.work_id IS NOT NULL
),
resolved AS (
  SELECT blog_post_id, min(slug) AS slug
  FROM work_cat
  WHERE slug IS NOT NULL
  GROUP BY blog_post_id
  HAVING count(DISTINCT slug) = 1
)
UPDATE public.blog_posts p
SET category_slug = r.slug
FROM resolved r
WHERE p.id = r.blog_post_id
  AND p.category_slug = 'general';