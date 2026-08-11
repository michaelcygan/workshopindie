CREATE OR REPLACE FUNCTION public.traffic_hourly(_hours integer DEFAULT 24)
RETURNS TABLE(hour timestamptz, page_views bigint, unique_visitors bigint, visits bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT date_trunc('hour', now()) - make_interval(hours => GREATEST(COALESCE(_hours, 24), 1) - 1) AS start_hour
  ),
  buckets AS (
    SELECT generate_series(b.start_hour, date_trunc('hour', now()), interval '1 hour') AS hour FROM bounds b
  ),
  agg AS (
    SELECT date_trunc('hour', viewed_at) AS hour,
           count(*) AS page_views,
           count(DISTINCT visitor_id) AS unique_visitors,
           count(DISTINCT session_id) AS visits
    FROM public.traffic_pageviews, bounds b
    WHERE viewed_at >= b.start_hour
    GROUP BY 1
  )
  SELECT k.hour,
         COALESCE(a.page_views, 0),
         COALESCE(a.unique_visitors, 0),
         COALESCE(a.visits, 0)
  FROM buckets k LEFT JOIN agg a ON a.hour = k.hour
  ORDER BY k.hour
$function$;

REVOKE ALL ON FUNCTION public.traffic_hourly(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.traffic_hourly(integer) TO service_role;