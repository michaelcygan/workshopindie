CREATE OR REPLACE VIEW public.vw_tracking_link_stats
WITH (security_invoker = true) AS
SELECT
  l.id,
  l.slug,
  l.name,
  l.destination_path,
  l.is_active,
  l.created_at,
  COALESCE(c.total_clicks, 0)::bigint  AS total_clicks,
  COALESCE(c.member_clicks, 0)::bigint AS member_clicks,
  COALESCE(c.guest_clicks, 0)::bigint  AS guest_clicks,
  COALESCE(c.clicks_7d, 0)::bigint     AS clicks_7d,
  c.first_click_at,
  c.last_click_at
FROM public.tracking_links l
LEFT JOIN (
  SELECT
    tracking_link_id,
    count(*) AS total_clicks,
    count(*) FILTER (WHERE visitor_type = 'member') AS member_clicks,
    count(*) FILTER (WHERE visitor_type = 'guest')  AS guest_clicks,
    count(*) FILTER (WHERE clicked_at >= now() - interval '7 days') AS clicks_7d,
    min(clicked_at) AS first_click_at,
    max(clicked_at) AS last_click_at
  FROM public.tracking_link_clicks
  GROUP BY tracking_link_id
) c ON c.tracking_link_id = l.id;

GRANT SELECT ON public.vw_tracking_link_stats TO authenticated;
GRANT SELECT ON public.vw_tracking_link_stats TO service_role;

CREATE OR REPLACE FUNCTION public.tracking_link_daily(_link_id uuid, _days integer DEFAULT 90)
RETURNS TABLE (day date, total bigint, members bigint, guests bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (clicked_at AT TIME ZONE 'UTC')::date AS day,
    count(*)::bigint,
    count(*) FILTER (WHERE visitor_type = 'member')::bigint,
    count(*) FILTER (WHERE visitor_type = 'guest')::bigint
  FROM public.tracking_link_clicks
  WHERE tracking_link_id = _link_id
    AND public.has_role(auth.uid(), 'admin')
    AND clicked_at >= now() - make_interval(days => GREATEST(COALESCE(_days, 90), 1))
  GROUP BY 1
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.tracking_link_locations(_link_id uuid, _days integer DEFAULT NULL)
RETURNS TABLE (city text, region text, country text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT city, region, country, count(*)::bigint
  FROM public.tracking_link_clicks
  WHERE tracking_link_id = _link_id
    AND public.has_role(auth.uid(), 'admin')
    AND (_days IS NULL OR clicked_at >= now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY 1, 2, 3
  ORDER BY 4 DESC
  LIMIT 25;
$$;

CREATE OR REPLACE FUNCTION public.tracking_link_referrers(_link_id uuid, _days integer DEFAULT NULL)
RETURNS TABLE (referrer text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(referrer, 'direct'), count(*)::bigint
  FROM public.tracking_link_clicks
  WHERE tracking_link_id = _link_id
    AND public.has_role(auth.uid(), 'admin')
    AND (_days IS NULL OR clicked_at >= now() - make_interval(days => GREATEST(_days, 1)))
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 25;
$$;

REVOKE EXECUTE ON FUNCTION public.tracking_link_daily(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tracking_link_locations(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tracking_link_referrers(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tracking_link_daily(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_link_locations(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tracking_link_referrers(uuid, integer) TO authenticated, service_role;