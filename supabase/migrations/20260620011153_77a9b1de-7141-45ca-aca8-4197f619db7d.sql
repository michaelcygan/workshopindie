
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, target_type text, target_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND actor_user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log (target_type, target_id);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  notes text, updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.feature_flags TO authenticated, anon;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads flags" ON public.feature_flags FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins write flags" ON public.feature_flags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.mod_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT true,
  threshold integer, window_seconds integer, action text NOT NULL,
  notes text, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mod_rules TO authenticated;
GRANT ALL ON public.mod_rules TO service_role;
ALTER TABLE public.mod_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage mod rules" ON public.mod_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL, body text NOT NULL,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipients_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read broadcasts" ON public.admin_broadcasts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins write broadcasts" ON public.admin_broadcasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND sent_by = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_log(_action text, _target_type text, _target_id uuid, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  INSERT INTO public.admin_audit_log (actor_user_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), _action, _target_type, _target_id, COALESCE(_payload, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE VIEW public.vw_daily_signups AS
SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS signups
FROM public.profiles WHERE created_at > now() - interval '365 days'
GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW public.vw_dau_series AS
SELECT date_trunc('day', last_active_at)::date AS day, count(DISTINCT id)::int AS dau
FROM public.profiles WHERE last_active_at IS NOT NULL AND last_active_at > now() - interval '90 days'
GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW public.vw_kpi_now AS
SELECT
  (SELECT count(*) FROM public.profiles)::int AS total_users,
  (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days')::int AS signups_7d,
  (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days')::int AS signups_30d,
  (SELECT count(DISTINCT id) FROM public.profiles WHERE last_active_at > now() - interval '1 day')::int AS dau,
  (SELECT count(DISTINCT id) FROM public.profiles WHERE last_active_at > now() - interval '7 days')::int AS wau,
  (SELECT count(DISTINCT id) FROM public.profiles WHERE last_active_at > now() - interval '30 days')::int AS mau,
  (SELECT count(*) FROM public.works WHERE published_at > now() - interval '7 days')::int AS works_published_7d,
  (SELECT count(*) FROM public.works WHERE published_at IS NOT NULL)::int AS works_total,
  (SELECT count(*) FROM public.collab_posts WHERE created_at > now() - interval '7 days')::int AS collabs_posted_7d,
  (SELECT count(*) FROM public.collab_posts)::int AS collabs_total,
  (SELECT count(*) FROM public.collab_contact_events WHERE sent_at > now() - interval '7 days')::int AS collab_applications_7d,
  (SELECT count(*) FROM public.collab_guest_applications WHERE created_at > now() - interval '7 days')::int AS collab_guest_applications_7d,
  (SELECT count(*) FROM public.workshops WHERE created_at > now() - interval '7 days')::int AS workshops_created_7d,
  (SELECT count(*) FROM public.workshops)::int AS workshops_total,
  (SELECT count(*) FROM public.workshop_applications WHERE submitted_at > now() - interval '7 days')::int AS workshop_apps_7d,
  (SELECT count(*) FROM public.group_event_rsvps WHERE created_at > now() - interval '7 days')::int AS event_rsvps_7d,
  (SELECT count(*) FROM public.subscriptions WHERE tier='plus' AND status IN ('active','trialing') AND (current_period_end IS NULL OR current_period_end > now()))::int AS active_subs,
  (SELECT count(*) FROM public.follows WHERE created_at > now() - interval '7 days')::int AS follows_7d,
  (SELECT count(*) FROM public.reports WHERE status='open')::int AS open_reports;

CREATE OR REPLACE VIEW public.vw_signup_cohort_retention AS
WITH cohorts AS (SELECT id, date_trunc('week', created_at)::date AS cohort_week FROM public.profiles WHERE created_at > now() - interval '12 weeks'),
sizes AS (SELECT cohort_week, count(*)::int AS cohort_size FROM cohorts GROUP BY 1),
activity AS (
  SELECT c.cohort_week,
    floor(extract(epoch from (date_trunc('week', p.last_active_at) - c.cohort_week)) / (7*86400))::int AS week_n,
    count(DISTINCT p.id)::int AS retained
  FROM cohorts c JOIN public.profiles p ON p.id = c.id
  WHERE p.last_active_at IS NOT NULL AND p.last_active_at >= c.cohort_week
  GROUP BY 1, 2
)
SELECT a.cohort_week, s.cohort_size, a.week_n, a.retained,
       round(100.0 * a.retained / NULLIF(s.cohort_size,0), 1) AS retained_pct
FROM activity a JOIN sizes s USING (cohort_week)
WHERE a.week_n BETWEEN 0 AND 12;

CREATE OR REPLACE VIEW public.vw_referral_leaderboard AS
SELECT p.referred_by AS user_id, ref.username, ref.display_name, ref.avatar_url,
  count(*)::int AS signups,
  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id AND s.tier='plus' AND s.status IN ('active','trialing')))::int AS paid_conversions
FROM public.profiles p JOIN public.profiles ref ON ref.id = p.referred_by
WHERE p.referred_by IS NOT NULL
GROUP BY p.referred_by, ref.username, ref.display_name, ref.avatar_url
ORDER BY signups DESC LIMIT 100;

CREATE OR REPLACE VIEW public.vw_acquisition_funnel AS
SELECT
  (SELECT count(*) FROM public.share_events WHERE created_at > now() - interval '90 days')::int AS share_clicks,
  (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '90 days')::int AS signups,
  (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '90 days' AND onboarded = true)::int AS onboarded,
  (SELECT count(DISTINCT p.id) FROM public.profiles p WHERE p.created_at > now() - interval '90 days' AND (
     EXISTS (SELECT 1 FROM public.works w WHERE w.created_by = p.id AND w.published_at IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.collab_posts c WHERE c.user_id = p.id)
     OR EXISTS (SELECT 1 FROM public.group_event_rsvps r WHERE r.user_id = p.id)
     OR EXISTS (SELECT 1 FROM public.workshop_applications a WHERE a.user_id = p.id)
  ))::int AS first_action,
  (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '90 days' AND last_active_at > created_at + interval '6 days')::int AS retained_d7;

CREATE OR REPLACE VIEW public.vw_works_funnel AS
SELECT
  count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS works_created_30d,
  count(*) FILTER (WHERE status='draft' AND created_at > now() - interval '30 days')::int AS drafts_30d,
  count(*) FILTER (WHERE published_at > now() - interval '30 days')::int AS published_30d,
  count(*) FILTER (WHERE is_collaborative AND published_at > now() - interval '30 days')::int AS collaborative_published_30d
FROM public.works;

CREATE OR REPLACE VIEW public.vw_collab_funnel AS
SELECT
  (SELECT count(*) FROM public.collab_posts WHERE created_at > now() - interval '30 days')::int AS posts_30d,
  (SELECT count(*) FROM public.collab_posts WHERE status='open')::int AS open_now,
  (SELECT count(*) FROM public.collab_posts WHERE status='closed')::int AS closed_total,
  (SELECT count(*) FROM public.collab_contact_events WHERE sent_at > now() - interval '30 days')::int AS applications_30d,
  (SELECT count(*) FROM public.collab_guest_applications WHERE created_at > now() - interval '30 days')::int AS guest_applications_30d,
  (SELECT count(*) FROM public.collab_posts WHERE resulting_work_id IS NOT NULL AND created_at > now() - interval '90 days')::int AS converted_to_work_90d;

CREATE OR REPLACE VIEW public.vw_workshop_funnel AS
SELECT
  (SELECT count(*) FROM public.workshops WHERE created_at > now() - interval '30 days')::int AS created_30d,
  (SELECT count(*) FROM public.workshops WHERE status IN ('open','check_in','active','finalizing'))::int AS live_now,
  (SELECT count(*) FROM public.workshop_applications WHERE submitted_at > now() - interval '30 days')::int AS apps_30d,
  (SELECT count(*) FROM public.workshop_applications WHERE status = 'confirmed' AND confirmed_at > now() - interval '30 days')::int AS confirmed_30d,
  (SELECT round(100.0 * sum(confirmed_count) / NULLIF(sum(participant_cap),0), 1) FROM public.workshops WHERE participant_cap > 0 AND created_at > now() - interval '90 days')::numeric AS avg_fill_pct_90d;

CREATE OR REPLACE VIEW public.vw_marketplace_health AS
SELECT
  (SELECT count(*) FROM public.collab_posts)::int AS collabs_total,
  (SELECT count(*) FROM public.collab_posts WHERE status='open')::int AS collabs_open,
  (SELECT count(*) FROM public.collab_posts WHERE status='closed')::int AS collabs_closed,
  (SELECT round(avg(extract(epoch from (c.sent_at - p.created_at))/3600.0)::numeric, 1)
     FROM public.collab_posts p
     JOIN LATERAL (SELECT min(sent_at) AS sent_at FROM public.collab_contact_events e WHERE e.collab_post_id = p.id) c ON true
     WHERE p.created_at > now() - interval '90 days' AND c.sent_at IS NOT NULL) AS avg_time_to_first_app_hours,
  (SELECT round(avg(extract(epoch from (closed_at - created_at))/86400.0)::numeric, 1)
     FROM public.collab_posts WHERE closed_at IS NOT NULL AND created_at > now() - interval '90 days') AS avg_time_to_close_days,
  (SELECT round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.collab_vouches v WHERE v.collab_post_id = p.id)) / NULLIF(count(*),0), 1)
     FROM public.collab_posts p WHERE created_at > now() - interval '90 days')::numeric AS pct_with_vouches_90d;

CREATE OR REPLACE VIEW public.vw_engagement_by_surface_7d AS
SELECT 'works'::text AS surface,
       (SELECT count(DISTINCT created_by) FROM public.works WHERE published_at > now() - interval '7 days')::int AS active_users,
       (SELECT count(*) FROM public.works WHERE published_at > now() - interval '7 days')::int AS actions
UNION ALL SELECT 'collabs',
       (SELECT count(DISTINCT user_id) FROM public.collab_posts WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.collab_posts WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'collab_applications',
       (SELECT count(DISTINCT sender_user_id) FROM public.collab_contact_events WHERE sent_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.collab_contact_events WHERE sent_at > now() - interval '7 days')::int
UNION ALL SELECT 'workshops',
       (SELECT count(DISTINCT host_user_id) FROM public.workshops WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.workshops WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'workshop_applications',
       (SELECT count(DISTINCT user_id) FROM public.workshop_applications WHERE submitted_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.workshop_applications WHERE submitted_at > now() - interval '7 days')::int
UNION ALL SELECT 'group_event_rsvps',
       (SELECT count(DISTINCT user_id) FROM public.group_event_rsvps WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.group_event_rsvps WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'follows',
       (SELECT count(DISTINCT follower_user_id) FROM public.follows WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.follows WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'comments',
       (SELECT count(DISTINCT user_id) FROM public.comments WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.comments WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'dms',
       (SELECT count(DISTINCT sender_id) FROM public.messages WHERE created_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days')::int
UNION ALL SELECT 'instant_rooms',
       (SELECT count(DISTINCT user_id) FROM public.instant_presence WHERE last_seen_at > now() - interval '7 days')::int,
       (SELECT count(*) FROM public.instant_presence WHERE last_seen_at > now() - interval '7 days')::int;

CREATE OR REPLACE VIEW public.vw_city_activity_7d AS
SELECT c.id AS city_id, c.name, c.country, c.latitude, c.longitude,
  (SELECT count(*) FROM public.profiles p WHERE p.home_city_id = c.id AND p.last_active_at > now() - interval '7 days')::int AS active_users,
  (SELECT count(*) FROM public.profiles p WHERE p.home_city_id = c.id)::int AS members,
  (SELECT count(*) FROM public.works w WHERE w.city_id = c.id AND w.published_at > now() - interval '7 days')::int AS works_7d,
  (SELECT count(*) FROM public.collab_posts cp WHERE cp.city_id = c.id AND cp.created_at > now() - interval '7 days')::int AS collabs_7d,
  (SELECT count(*) FROM public.workshops wk WHERE wk.city_id = c.id AND wk.created_at > now() - interval '7 days')::int AS workshops_7d
FROM public.cities c
WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_country_activity_7d AS
SELECT country, sum(members)::int AS members, sum(active_users)::int AS active_users,
       sum(works_7d)::int AS works_7d, sum(collabs_7d)::int AS collabs_7d, sum(workshops_7d)::int AS workshops_7d
FROM public.vw_city_activity_7d WHERE country IS NOT NULL
GROUP BY country ORDER BY active_users DESC;

CREATE OR REPLACE VIEW public.vw_subscription_status_counts AS
SELECT environment::text AS environment, status::text AS status, tier::text AS tier, count(*)::int AS n
FROM public.subscriptions GROUP BY environment, status, tier;

CREATE OR REPLACE VIEW public.vw_mrr_series AS
WITH weeks AS (
  SELECT generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week')::date AS wk
)
SELECT w.wk AS week,
  (SELECT count(*) FROM public.subscriptions s
    WHERE s.tier='plus' AND s.environment='live'
      AND s.created_at <= w.wk + interval '6 days'
      AND (s.current_period_end IS NULL OR s.current_period_end > w.wk))::int AS active_subs
FROM weeks w;

CREATE OR REPLACE VIEW public.vw_failed_payments AS
SELECT s.id, s.user_id, p.username, p.display_name, s.status::text AS status, s.tier::text AS tier,
       s.current_period_end, s.environment::text AS environment, s.stripe_customer_id, s.updated_at
FROM public.subscriptions s LEFT JOIN public.profiles p ON p.id = s.user_id
WHERE s.status IN ('past_due','incomplete')
ORDER BY s.updated_at DESC LIMIT 200;

GRANT SELECT ON public.vw_daily_signups, public.vw_dau_series, public.vw_kpi_now,
  public.vw_signup_cohort_retention, public.vw_referral_leaderboard,
  public.vw_acquisition_funnel, public.vw_works_funnel, public.vw_collab_funnel,
  public.vw_workshop_funnel, public.vw_marketplace_health,
  public.vw_engagement_by_surface_7d, public.vw_city_activity_7d, public.vw_country_activity_7d,
  public.vw_subscription_status_counts, public.vw_mrr_series, public.vw_failed_payments
TO service_role;
