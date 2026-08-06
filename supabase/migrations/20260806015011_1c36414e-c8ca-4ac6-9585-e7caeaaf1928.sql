CREATE TABLE IF NOT EXISTS public.group_news_cache (
  slug text PRIMARY KEY,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_news_cache TO anon;
GRANT SELECT ON public.group_news_cache TO authenticated;
GRANT ALL ON public.group_news_cache TO service_role;
ALTER TABLE public.group_news_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "group_news_cache_public_read" ON public.group_news_cache;
CREATE POLICY "group_news_cache_public_read" ON public.group_news_cache FOR SELECT TO anon, authenticated USING (true);