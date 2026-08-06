-- Canonical current-vs-prior period metrics. Every admin page reads members/MAU/WAC from here.
CREATE OR REPLACE VIEW public.vw_kpi_periods
WITH (security_invoker = on) AS
SELECT
  (SELECT count(*) FROM public.vw_countable_profiles)::integer AS members_total,
  (SELECT count(*) FROM public.vw_countable_profiles WHERE created_at > now() - interval '7 days')::integer AS signups_7d,
  (SELECT count(*) FROM public.vw_countable_profiles WHERE created_at > now() - interval '14 days' AND created_at <= now() - interval '7 days')::integer AS signups_prev_7d,
  (SELECT count(*) FROM public.vw_countable_profiles WHERE created_at > now() - interval '30 days')::integer AS signups_30d,
  (SELECT count(*) FROM public.vw_countable_profiles WHERE created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days')::integer AS signups_prev_30d,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE day >= current_date)::integer AS dau,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE day > current_date - 7)::integer AS wau,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE day > current_date - 14 AND day <= current_date - 7)::integer AS wau_prev,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE day > current_date - 30)::integer AS mau,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE day > current_date - 60 AND day <= current_date - 30)::integer AS mau_prev,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE is_creative AND day > current_date - 7)::integer AS wac,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE is_creative AND day > current_date - 14 AND day <= current_date - 7)::integer AS wac_prev,
  (SELECT count(DISTINCT user_id) FROM public.vw_user_activity_day WHERE is_creative AND day > current_date - 30)::integer AS mac,
  (SELECT sum(actions) FROM public.vw_user_activity_day WHERE is_creative AND day > current_date - 30)::integer AS actions_30d,
  (SELECT sum(actions) FROM public.vw_user_activity_day WHERE is_creative AND day > current_date - 60 AND day <= current_date - 30)::integer AS actions_prev_30d,
  (SELECT count(*) FROM public.vw_user_activation WHERE onboarded)::integer AS onboarded_total,
  (SELECT count(*) FROM public.vw_user_activation WHERE activated)::integer AS activated_total,
  (SELECT count(*) FROM public.vw_user_activation WHERE created_at > now() - interval '30 days')::integer AS cohort_30d,
  (SELECT count(*) FROM public.vw_user_activation WHERE created_at > now() - interval '30 days' AND activated)::integer AS cohort_30d_activated,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='works' AND day > current_date - 30)::integer AS works_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='works' AND day > current_date - 60 AND day <= current_date - 30)::integer AS works_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='collabs' AND day > current_date - 30)::integer AS collabs_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='collabs' AND day > current_date - 60 AND day <= current_date - 30)::integer AS collabs_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='collab_applications' AND day > current_date - 30)::integer AS applications_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='collab_applications' AND day > current_date - 60 AND day <= current_date - 30)::integer AS applications_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='blog' AND day > current_date - 30)::integer AS blog_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='blog' AND day > current_date - 60 AND day <= current_date - 30)::integer AS blog_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='events' AND day > current_date - 30)::integer AS events_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='events' AND day > current_date - 60 AND day <= current_date - 30)::integer AS events_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='event_rsvps' AND day > current_date - 30)::integer AS rsvps_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='event_rsvps' AND day > current_date - 60 AND day <= current_date - 30)::integer AS rsvps_prev_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='group_posts' AND day > current_date - 30)::integer AS group_posts_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='group_joins' AND day > current_date - 30)::integer AS group_joins_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='follows' AND day > current_date - 30)::integer AS follows_30d,
  (SELECT coalesce(sum(actions),0) FROM public.vw_user_activity_day WHERE surface='follows' AND day > current_date - 60 AND day <= current_date - 30)::integer AS follows_prev_30d,
  (SELECT coalesce(sum(minutes),0) FROM public.lounge_audio_daily WHERE day > current_date - 30)::integer AS lounge_minutes_30d,
  (SELECT coalesce(sum(minutes),0) FROM public.lounge_audio_daily WHERE day > current_date - 60 AND day <= current_date - 30)::integer AS lounge_minutes_prev_30d,
  (SELECT count(*) FROM public.reports WHERE status = 'open')::integer AS open_reports,
  now() AS computed_at;

-- Daily signups plus cumulative membership, all time.
CREATE OR REPLACE VIEW public.vw_membership_growth
WITH (security_invoker = on) AS
WITH daily AS (
  SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::integer AS signups
  FROM public.vw_countable_profiles
  GROUP BY 1
)
SELECT day,
       signups,
       (sum(signups) OVER (ORDER BY day))::integer AS members_cumulative
FROM daily
ORDER BY day;

-- D1/D7/D30. Retained = at least one qualifying activity after signup day and within
-- N days of signup. Denominator = members whose account is at least N days old.
CREATE OR REPLACE VIEW public.vw_retention_headline
WITH (security_invoker = on) AS
SELECT w.window_days,
       (SELECT count(*) FROM public.vw_countable_profiles p
         WHERE p.created_at <= now() - (w.window_days || ' days')::interval)::integer AS eligible,
       (SELECT count(*) FROM public.vw_countable_profiles p
         WHERE p.created_at <= now() - (w.window_days || ' days')::interval
           AND EXISTS (
             SELECT 1 FROM public.vw_user_activity_day d
             WHERE d.user_id = p.id
               AND d.day > (p.created_at AT TIME ZONE 'UTC')::date
               AND d.day <= ((p.created_at AT TIME ZONE 'UTC')::date + w.window_days)
           ))::integer AS retained
FROM (VALUES (1), (7), (30)) AS w(window_days);

-- Weekly signup cohorts x weeks-since-signup, computed from real activity days.
CREATE OR REPLACE VIEW public.vw_cohort_retention_weekly
WITH (security_invoker = on) AS
WITH cohorts AS (
  SELECT id, date_trunc('week', created_at)::date AS cohort_week
  FROM public.vw_countable_profiles
  WHERE created_at > now() - interval '84 days'
), sizes AS (
  SELECT cohort_week, count(*)::integer AS cohort_size FROM cohorts GROUP BY 1
), act AS (
  SELECT c.cohort_week,
         (floor((d.day - c.cohort_week) / 7.0))::integer AS week_n,
         count(DISTINCT d.user_id)::integer AS retained
  FROM cohorts c
  JOIN public.vw_user_activity_day d ON d.user_id = c.id AND d.day >= c.cohort_week
  GROUP BY 1, 2
)
SELECT a.cohort_week,
       s.cohort_size,
       a.week_n,
       a.retained,
       round(100.0 * a.retained / NULLIF(s.cohort_size, 0), 1) AS retained_pct,
       (a.cohort_week + (a.week_n * 7)) <= current_date AS week_complete
FROM act a
JOIN sizes s USING (cohort_week)
WHERE a.week_n BETWEEN 0 AND 12;

-- Product surfaces over 30 days, with prior period, first-activation and returning users.
CREATE OR REPLACE VIEW public.vw_surface_30d
WITH (security_invoker = on) AS
WITH cur AS (
  SELECT surface,
         count(DISTINCT user_id)::integer AS active_users,
         sum(actions)::integer AS actions
  FROM public.vw_user_activity_day
  WHERE day > current_date - 30
  GROUP BY surface
), prev AS (
  SELECT surface,
         count(DISTINCT user_id)::integer AS prev_active_users,
         sum(actions)::integer AS prev_actions
  FROM public.vw_user_activity_day
  WHERE day > current_date - 60 AND day <= current_date - 30
  GROUP BY surface
), repeat_users AS (
  SELECT surface, count(*)::integer AS returning_users
  FROM (
    SELECT surface, user_id
    FROM public.vw_user_activity_day
    WHERE day > current_date - 30
    GROUP BY surface, user_id
    HAVING count(DISTINCT day) >= 2
  ) t
  GROUP BY surface
), activated AS (
  SELECT first_action_surface AS surface, count(*)::integer AS activated_users
  FROM public.vw_user_activation
  WHERE activated AND first_action_day > current_date - 30
  GROUP BY 1
)
SELECT c.surface,
       c.active_users,
       c.actions,
       coalesce(p.prev_active_users, 0) AS prev_active_users,
       coalesce(p.prev_actions, 0) AS prev_actions,
       coalesce(r.returning_users, 0) AS returning_users,
       coalesce(a.activated_users, 0) AS activated_users
FROM cur c
LEFT JOIN prev p USING (surface)
LEFT JOIN repeat_users r USING (surface)
LEFT JOIN activated a USING (surface);

-- City-level market table. Members = home city. All windows are 30 days.
CREATE OR REPLACE VIEW public.vw_geo_city_stats
WITH (security_invoker = on) AS
SELECT c.id AS city_id,
       c.name,
       c.state_region,
       c.country,
       c.country_code,
       c.latitude,
       c.longitude,
       (SELECT count(*) FROM public.vw_countable_profiles p WHERE p.home_city_id = c.id)::integer AS members,
       (SELECT count(*) FROM public.vw_countable_profiles p WHERE p.home_city_id = c.id AND p.created_at > now() - interval '30 days')::integer AS new_30d,
       (SELECT count(*) FROM public.vw_countable_profiles p WHERE p.home_city_id = c.id AND p.created_at > now() - interval '60 days' AND p.created_at <= now() - interval '30 days')::integer AS new_prev_30d,
       (SELECT count(DISTINCT d.user_id) FROM public.vw_user_activity_day d
          JOIN public.vw_countable_profiles p ON p.id = d.user_id
         WHERE p.home_city_id = c.id AND d.day > current_date - 30)::integer AS mau,
       (SELECT count(*) FROM public.vw_user_activation a
          JOIN public.vw_countable_profiles p ON p.id = a.user_id
         WHERE p.home_city_id = c.id AND a.activated)::integer AS activated,
       (SELECT coalesce(sum(d.actions),0) FROM public.vw_user_activity_day d
          JOIN public.vw_countable_profiles p ON p.id = d.user_id
         WHERE p.home_city_id = c.id AND d.surface = 'works' AND d.day > current_date - 30)::integer AS works_30d,
       (SELECT coalesce(sum(d.actions),0) FROM public.vw_user_activity_day d
          JOIN public.vw_countable_profiles p ON p.id = d.user_id
         WHERE p.home_city_id = c.id AND d.surface = 'collabs' AND d.day > current_date - 30)::integer AS collabs_30d
FROM public.cities c
WHERE c.merged_into_city_id IS NULL;

CREATE OR REPLACE VIEW public.vw_geo_country_stats
WITH (security_invoker = on) AS
SELECT coalesce(country_code, 'XX') AS country_code,
       max(country) AS country,
       sum(members)::integer AS members,
       sum(new_30d)::integer AS new_30d,
       sum(new_prev_30d)::integer AS new_prev_30d,
       sum(mau)::integer AS mau,
       sum(activated)::integer AS activated,
       sum(works_30d)::integer AS works_30d,
       sum(collabs_30d)::integer AS collabs_30d
FROM public.vw_geo_city_stats
GROUP BY coalesce(country_code, 'XX');

-- Subscription snapshot. Amount per subscription is not stored, so MRR is computed
-- in the app from the live Plus price; trials are excluded from revenue.
CREATE OR REPLACE VIEW public.vw_revenue_now
WITH (security_invoker = on) AS
SELECT
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='active' AND (current_period_end IS NULL OR current_period_end > now()))::integer AS live_active_paid,
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='trialing' AND (current_period_end IS NULL OR current_period_end > now()))::integer AS live_trialing,
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='past_due')::integer AS live_past_due,
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='canceled')::integer AS live_canceled_total,
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='active' AND created_at > now() - interval '30 days')::integer AS new_paid_30d,
  (SELECT count(*) FROM public.subscriptions WHERE environment='live' AND tier='plus' AND status='active' AND created_at > now() - interval '60 days' AND created_at <= now() - interval '30 days')::integer AS new_paid_prev_30d,
  (SELECT count(*) FROM public.subscriptions WHERE environment='sandbox' AND tier='plus' AND status IN ('active','trialing'))::integer AS sandbox_plus,
  (SELECT count(*) FROM public.vw_countable_profiles)::integer AS eligible_members;

GRANT SELECT ON public.vw_kpi_periods TO service_role;
GRANT SELECT ON public.vw_membership_growth TO service_role;
GRANT SELECT ON public.vw_retention_headline TO service_role;
GRANT SELECT ON public.vw_cohort_retention_weekly TO service_role;
GRANT SELECT ON public.vw_surface_30d TO service_role;
GRANT SELECT ON public.vw_geo_city_stats TO service_role;
GRANT SELECT ON public.vw_geo_country_stats TO service_role;
GRANT SELECT ON public.vw_revenue_now TO service_role;