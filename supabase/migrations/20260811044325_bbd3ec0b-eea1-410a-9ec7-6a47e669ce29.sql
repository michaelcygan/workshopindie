CREATE TABLE IF NOT EXISTS public.traffic_live_sessions (
  session_id uuid PRIMARY KEY,
  visitor_type text NOT NULL DEFAULT 'guest',
  path text NOT NULL,
  city text,
  region text,
  country text,
  source text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS traffic_live_sessions_last_seen_idx
  ON public.traffic_live_sessions (last_seen_at DESC);

GRANT ALL ON public.traffic_live_sessions TO service_role;

ALTER TABLE public.traffic_live_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.traffic_live_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT * FROM public.traffic_live_sessions
    WHERE last_seen_at >= now() - interval '2 minutes'
  ),
  heat AS (
    SELECT path,
           count(*) FILTER (WHERE viewed_at >= now() - interval '10 minutes') AS recent,
           count(*) FILTER (WHERE viewed_at >= now() - interval '20 minutes'
                              AND viewed_at <  now() - interval '10 minutes') AS prior
    FROM public.traffic_pageviews
    WHERE viewed_at >= now() - interval '20 minutes'
    GROUP BY path
  ),
  pages AS (
    SELECT l.path, count(*)::int AS live,
           COALESCE(max(h.recent), 0) > COALESCE(max(h.prior), 0) + 2 AS heating_up
    FROM live l LEFT JOIN heat h ON h.path = l.path
    GROUP BY l.path
    ORDER BY count(*) DESC, l.path
    LIMIT 8
  ),
  cities AS (
    SELECT city, region, country, count(*)::int AS live
    FROM live
    WHERE city IS NOT NULL OR country IS NOT NULL
    GROUP BY city, region, country
    ORDER BY count(*) DESC
    LIMIT 8
  ),
  sources AS (
    SELECT COALESCE(source, 'Direct') AS source, count(*)::int AS live
    FROM live
    GROUP BY COALESCE(source, 'Direct')
    ORDER BY count(*) DESC
    LIMIT 8
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*)::int FROM live),
    'members', (SELECT count(*)::int FROM live WHERE visitor_type = 'member'),
    'guests', (SELECT count(*)::int FROM live WHERE visitor_type <> 'member'),
    'pages', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM pages p), '[]'::jsonb),
    'cities', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM cities c), '[]'::jsonb),
    'sources', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM sources s), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.traffic_live_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.traffic_live_snapshot() FROM anon;
REVOKE ALL ON FUNCTION public.traffic_live_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.traffic_live_snapshot() TO service_role;