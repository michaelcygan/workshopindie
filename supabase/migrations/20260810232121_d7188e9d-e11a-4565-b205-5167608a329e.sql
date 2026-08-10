CREATE TABLE public.traffic_pageviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  session_id uuid NOT NULL,
  path text NOT NULL,
  route_pattern text,
  visitor_type text NOT NULL DEFAULT 'guest',
  referrer text,
  city text,
  region text,
  country text,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_pageviews_visitor_type_chk CHECK (visitor_type IN ('guest','member')),
  CONSTRAINT traffic_pageviews_path_chk CHECK (path ~ '^/' AND length(path) <= 512 AND path !~ '[?#]')
);

GRANT ALL ON public.traffic_pageviews TO service_role;
ALTER TABLE public.traffic_pageviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX traffic_pageviews_viewed_at_idx ON public.traffic_pageviews (viewed_at DESC);
CREATE INDEX traffic_pageviews_viewed_session_idx ON public.traffic_pageviews (viewed_at, session_id);
CREATE INDEX traffic_pageviews_viewed_path_idx ON public.traffic_pageviews (viewed_at, path);
CREATE INDEX traffic_pageviews_session_time_idx ON public.traffic_pageviews (session_id, viewed_at);
CREATE INDEX traffic_pageviews_viewed_visitor_idx ON public.traffic_pageviews (viewed_at, visitor_id);

-- days = 0 means "all time"
CREATE OR REPLACE FUNCTION public.traffic_since(_days integer)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN COALESCE(_days,0) <= 0 THEN '-infinity'::timestamptz
              ELSE now() - make_interval(days => _days) END
$$;

CREATE OR REPLACE FUNCTION public.traffic_overview(_days integer DEFAULT 30)
RETURNS TABLE (page_views bigint, unique_visitors bigint, visits bigint, bounced_visits bigint, member_views bigint, guest_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT * FROM public.traffic_pageviews WHERE viewed_at >= public.traffic_since(_days)
  ), s AS (
    SELECT session_id, count(*) AS n FROM pv GROUP BY session_id
  )
  SELECT (SELECT count(*) FROM pv),
         (SELECT count(DISTINCT visitor_id) FROM pv),
         (SELECT count(*) FROM s),
         (SELECT count(*) FROM s WHERE n = 1),
         (SELECT count(*) FROM pv WHERE visitor_type = 'member'),
         (SELECT count(*) FROM pv WHERE visitor_type = 'guest')
$$;

CREATE OR REPLACE FUNCTION public.traffic_daily(_days integer DEFAULT 30)
RETURNS TABLE (day date, page_views bigint, unique_visitors bigint, visits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (viewed_at AT TIME ZONE 'UTC')::date AS day,
         count(*), count(DISTINCT visitor_id), count(DISTINCT session_id)
  FROM public.traffic_pageviews
  WHERE viewed_at >= public.traffic_since(_days)
  GROUP BY 1 ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.traffic_pages(_days integer DEFAULT 30, _limit integer DEFAULT 100)
RETURNS TABLE (path text, route_pattern text, page_views bigint, unique_visitors bigint, entries bigint, bounces bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT *, row_number() OVER (PARTITION BY session_id ORDER BY viewed_at, id) AS rn,
           count(*) OVER (PARTITION BY session_id) AS session_len
    FROM public.traffic_pageviews WHERE viewed_at >= public.traffic_since(_days)
  )
  SELECT path,
         (array_agg(route_pattern) FILTER (WHERE route_pattern IS NOT NULL))[1],
         count(*), count(DISTINCT visitor_id),
         count(*) FILTER (WHERE rn = 1),
         count(*) FILTER (WHERE rn = 1 AND session_len = 1)
  FROM pv GROUP BY path ORDER BY 3 DESC LIMIT COALESCE(_limit, 100)
$$;

CREATE OR REPLACE FUNCTION public.traffic_routes(_days integer DEFAULT 30, _limit integer DEFAULT 100)
RETURNS TABLE (route_pattern text, page_views bigint, unique_visitors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(route_pattern, path), count(*), count(DISTINCT visitor_id)
  FROM public.traffic_pageviews
  WHERE viewed_at >= public.traffic_since(_days)
  GROUP BY 1 ORDER BY 2 DESC LIMIT COALESCE(_limit, 100)
$$;

CREATE OR REPLACE FUNCTION public.traffic_locations(_days integer DEFAULT 30, _limit integer DEFAULT 100)
RETURNS TABLE (city text, region text, country text, unique_visitors bigint, visits bigint, page_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT city, region, country,
         count(DISTINCT visitor_id), count(DISTINCT session_id), count(*)
  FROM public.traffic_pageviews
  WHERE viewed_at >= public.traffic_since(_days)
  GROUP BY 1,2,3 ORDER BY 6 DESC LIMIT COALESCE(_limit, 100)
$$;

CREATE OR REPLACE FUNCTION public.traffic_countries(_days integer DEFAULT 30, _limit integer DEFAULT 60)
RETURNS TABLE (country text, unique_visitors bigint, visits bigint, page_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT country, count(DISTINCT visitor_id), count(DISTINCT session_id), count(*)
  FROM public.traffic_pageviews
  WHERE viewed_at >= public.traffic_since(_days)
  GROUP BY 1 ORDER BY 4 DESC LIMIT COALESCE(_limit, 60)
$$;

-- Session source: the external referrer on the session's first pageview.
CREATE OR REPLACE FUNCTION public.traffic_referrers(_days integer DEFAULT 30, _limit integer DEFAULT 50)
RETURNS TABLE (source text, visits bigint, unique_visitors bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH firsts AS (
    SELECT DISTINCT ON (session_id) session_id, visitor_id, referrer
    FROM public.traffic_pageviews
    WHERE viewed_at >= public.traffic_since(_days)
    ORDER BY session_id, viewed_at, id
  )
  SELECT COALESCE(NULLIF(referrer, ''), 'Direct'), count(*), count(DISTINCT visitor_id)
  FROM firsts GROUP BY 1 ORDER BY 2 DESC LIMIT COALESCE(_limit, 50)
$$;

CREATE OR REPLACE FUNCTION public.traffic_entries(_days integer DEFAULT 30, _limit integer DEFAULT 50)
RETURNS TABLE (path text, visits bigint, bounces bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH pv AS (
    SELECT *, count(*) OVER (PARTITION BY session_id) AS session_len
    FROM public.traffic_pageviews WHERE viewed_at >= public.traffic_since(_days)
  ), firsts AS (
    SELECT DISTINCT ON (session_id) session_id, path, session_len
    FROM pv ORDER BY session_id, viewed_at, id
  )
  SELECT path, count(*), count(*) FILTER (WHERE session_len = 1)
  FROM firsts GROUP BY 1 ORDER BY 2 DESC LIMIT COALESCE(_limit, 50)
$$;

CREATE OR REPLACE FUNCTION public.traffic_exits(_days integer DEFAULT 30, _limit integer DEFAULT 50)
RETURNS TABLE (path text, visits bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lasts AS (
    SELECT DISTINCT ON (session_id) session_id, path
    FROM public.traffic_pageviews
    WHERE viewed_at >= public.traffic_since(_days)
    ORDER BY session_id, viewed_at DESC, id DESC
  )
  SELECT path, count(*) FROM lasts GROUP BY 1 ORDER BY 2 DESC LIMIT COALESCE(_limit, 50)
$$;

CREATE OR REPLACE FUNCTION public.traffic_transitions(_days integer DEFAULT 30, _limit integer DEFAULT 30)
RETURNS TABLE (from_path text, to_path text, transitions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH steps AS (
    SELECT session_id, path,
           lead(path) OVER (PARTITION BY session_id ORDER BY viewed_at, id) AS next_path
    FROM public.traffic_pageviews
    WHERE viewed_at >= public.traffic_since(_days)
  )
  SELECT path, next_path, count(*)
  FROM steps
  WHERE next_path IS NOT NULL AND next_path <> path
  GROUP BY 1,2 ORDER BY 3 DESC LIMIT COALESCE(_limit, 30)
$$;

REVOKE EXECUTE ON FUNCTION public.traffic_since(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_overview(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_daily(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_pages(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_routes(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_locations(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_countries(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_referrers(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_entries(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_exits(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.traffic_transitions(integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.traffic_since(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_overview(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_daily(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_pages(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_routes(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_locations(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_countries(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_referrers(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_entries(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_exits(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.traffic_transitions(integer, integer) TO service_role;