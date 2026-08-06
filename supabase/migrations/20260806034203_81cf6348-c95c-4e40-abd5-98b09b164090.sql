ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS analytics_excluded boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_works_published_at ON public.works (published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collab_posts_created_at ON public.collab_posts (created_at);
CREATE INDEX IF NOT EXISTS idx_collab_contact_events_sent_at ON public.collab_contact_events (sent_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts (published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_events_created_at ON public.group_events (created_at);
CREATE INDEX IF NOT EXISTS idx_group_event_rsvps_created_at ON public.group_event_rsvps (created_at);
CREATE INDEX IF NOT EXISTS idx_group_today_posts_created_at ON public.group_today_posts (created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_joined_at ON public.group_members (joined_at);
CREATE INDEX IF NOT EXISTS idx_instant_messages_created_at ON public.instant_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_lounge_audio_events_created_at ON public.lounge_audio_events (created_at);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments (created_at);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows (created_at);
CREATE INDEX IF NOT EXISTS idx_instant_presence_last_seen_at ON public.instant_presence (last_seen_at);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at);

-- Countable members: every non-deleted, non-excluded profile. Canonical denominator
-- for Total Members, MAU, activation and geography.
CREATE OR REPLACE VIEW public.vw_countable_profiles
WITH (security_invoker = on) AS
SELECT p.*
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND p.analytics_excluded = false;

-- Activity spine: one row per (member, day, surface). is_creative = the action counts
-- toward Weekly Active Creators / Activation. Passive presence is is_creative = false.
CREATE OR REPLACE VIEW public.vw_user_activity_day
WITH (security_invoker = on) AS
WITH raw AS (
  SELECT created_by AS user_id, published_at AS ts, 'works'::text AS surface, true AS is_creative
    FROM public.works WHERE published_at IS NOT NULL AND created_by IS NOT NULL
  UNION ALL
  SELECT user_id, created_at, 'collabs', true FROM public.collab_posts WHERE user_id IS NOT NULL
  UNION ALL
  SELECT sender_user_id, sent_at, 'collab_applications', true
    FROM public.collab_contact_events WHERE sender_user_id IS NOT NULL
  UNION ALL
  SELECT created_by, published_at, 'blog', true
    FROM public.blog_posts WHERE published_at IS NOT NULL AND created_by IS NOT NULL
  UNION ALL
  SELECT created_by, created_at, 'events', true
    FROM public.group_events WHERE deleted_at IS NULL AND created_by IS NOT NULL
  UNION ALL
  SELECT user_id, created_at, 'event_rsvps', true FROM public.group_event_rsvps WHERE user_id IS NOT NULL
  UNION ALL
  SELECT author_id, created_at, 'group_posts', true FROM public.group_today_posts WHERE author_id IS NOT NULL
  UNION ALL
  SELECT user_id, joined_at, 'group_joins', true FROM public.group_members WHERE user_id IS NOT NULL
  UNION ALL
  SELECT user_id, created_at, 'lounge_messages', true FROM public.instant_messages WHERE user_id IS NOT NULL
  UNION ALL
  SELECT user_id, created_at, 'lounge_audio', true FROM public.lounge_audio_events WHERE user_id IS NOT NULL
  UNION ALL
  SELECT user_id, created_at, 'comments', true FROM public.comments WHERE user_id IS NOT NULL
  UNION ALL
  SELECT follower_user_id, created_at, 'follows', true FROM public.follows WHERE follower_user_id IS NOT NULL
  UNION ALL
  SELECT user_id, last_seen_at, 'presence', false
    FROM public.instant_presence WHERE user_id IS NOT NULL AND last_seen_at IS NOT NULL
)
SELECT r.user_id,
       (r.ts AT TIME ZONE 'UTC')::date AS day,
       r.surface,
       r.is_creative,
       count(*)::integer AS actions
FROM raw r
JOIN public.vw_countable_profiles p ON p.id = r.user_id
WHERE r.ts IS NOT NULL
GROUP BY r.user_id, (r.ts AT TIME ZONE 'UTC')::date, r.surface, r.is_creative;

-- True daily actives, computed from the spine (not from a mutable last_active_at column).
CREATE OR REPLACE VIEW public.vw_dau_daily
WITH (security_invoker = on) AS
SELECT day,
       count(DISTINCT user_id)::integer AS active_users,
       count(DISTINCT user_id) FILTER (WHERE is_creative)::integer AS active_creators,
       sum(actions)::integer AS actions
FROM public.vw_user_activity_day
GROUP BY day
ORDER BY day;

-- Activation: first qualifying creative action per member.
CREATE OR REPLACE VIEW public.vw_user_activation
WITH (security_invoker = on) AS
SELECT p.id AS user_id,
       p.created_at,
       p.onboarded,
       a.first_action_day,
       a.first_action_surface,
       (a.first_action_day IS NOT NULL) AS activated
FROM public.vw_countable_profiles p
LEFT JOIN LATERAL (
  SELECT d.day AS first_action_day, d.surface AS first_action_surface
  FROM public.vw_user_activity_day d
  WHERE d.user_id = p.id AND d.is_creative
  ORDER BY d.day ASC
  LIMIT 1
) a ON true;

-- Weekly Active Creators: distinct members with >= 1 creative action in the week.
CREATE OR REPLACE VIEW public.vw_weekly_active_creators
WITH (security_invoker = on) AS
SELECT date_trunc('week', day::timestamp)::date AS week,
       count(DISTINCT user_id)::integer AS active_creators,
       sum(actions)::integer AS actions
FROM public.vw_user_activity_day
WHERE is_creative
GROUP BY 1
ORDER BY 1;

GRANT SELECT ON public.vw_countable_profiles TO service_role;
GRANT SELECT ON public.vw_user_activity_day TO service_role;
GRANT SELECT ON public.vw_dau_daily TO service_role;
GRANT SELECT ON public.vw_user_activation TO service_role;
GRANT SELECT ON public.vw_weekly_active_creators TO service_role;