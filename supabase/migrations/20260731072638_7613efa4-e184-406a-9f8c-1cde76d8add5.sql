-- Wave 7: admin metrics describe the active product (Lounge / Groups / Blog),
-- not the retired LegacyWorkshop entity. Views only; no data changes.

DROP VIEW IF EXISTS public.vw_kpi_now;
CREATE VIEW public.vw_kpi_now AS
SELECT
  (SELECT count(*) FROM profiles)::integer AS total_users,
  (SELECT count(*) FROM profiles WHERE profiles.created_at > now() - interval '7 days')::integer AS signups_7d,
  (SELECT count(*) FROM profiles WHERE profiles.created_at > now() - interval '30 days')::integer AS signups_30d,
  (SELECT count(DISTINCT profiles.id) FROM profiles WHERE profiles.last_active_at > now() - interval '1 day')::integer AS dau,
  (SELECT count(DISTINCT profiles.id) FROM profiles WHERE profiles.last_active_at > now() - interval '7 days')::integer AS wau,
  (SELECT count(DISTINCT profiles.id) FROM profiles WHERE profiles.last_active_at > now() - interval '30 days')::integer AS mau,
  (SELECT count(*) FROM works WHERE works.published_at > now() - interval '7 days')::integer AS works_published_7d,
  (SELECT count(*) FROM works WHERE works.published_at IS NOT NULL)::integer AS works_total,
  (SELECT count(*) FROM collab_posts WHERE collab_posts.created_at > now() - interval '7 days')::integer AS collabs_posted_7d,
  (SELECT count(*) FROM collab_posts)::integer AS collabs_total,
  (SELECT count(*) FROM collab_contact_events WHERE collab_contact_events.sent_at > now() - interval '7 days')::integer AS collab_applications_7d,
  (SELECT count(*) FROM collab_guest_applications WHERE collab_guest_applications.created_at > now() - interval '7 days')::integer AS collab_guest_applications_7d,
  (SELECT count(*) FROM instant_rooms WHERE instant_rooms.created_at > now() - interval '7 days')::integer AS lounge_rooms_opened_7d,
  (SELECT count(DISTINCT instant_presence.user_id) FROM instant_presence WHERE instant_presence.last_seen_at > now() - interval '7 days')::integer AS lounge_participants_7d,
  (SELECT COALESCE(sum(lounge_audio_daily.minutes), 0) FROM lounge_audio_daily WHERE lounge_audio_daily.day > (now() - interval '7 days')::date)::integer AS lounge_audio_minutes_7d,
  (SELECT count(*) FROM blog_posts WHERE blog_posts.published_at > now() - interval '7 days')::integer AS blog_posts_published_7d,
  (SELECT count(*) FROM group_events WHERE group_events.created_at > now() - interval '7 days' AND group_events.deleted_at IS NULL)::integer AS group_events_7d,
  (SELECT count(*) FROM group_event_rsvps WHERE group_event_rsvps.created_at > now() - interval '7 days')::integer AS event_rsvps_7d,
  (SELECT count(*) FROM subscriptions WHERE subscriptions.tier = 'plus'::subscription_tier AND subscriptions.status = ANY (ARRAY['active'::subscription_status, 'trialing'::subscription_status]) AND (subscriptions.current_period_end IS NULL OR subscriptions.current_period_end > now()))::integer AS active_subs,
  (SELECT count(*) FROM follows WHERE follows.created_at > now() - interval '7 days')::integer AS follows_7d,
  (SELECT count(*) FROM reports WHERE reports.status = 'open'::report_status)::integer AS open_reports;

DROP VIEW IF EXISTS public.vw_engagement_by_surface_7d;
CREATE VIEW public.vw_engagement_by_surface_7d AS
 SELECT 'works'::text AS surface,
   (SELECT count(DISTINCT works.created_by) FROM works WHERE works.published_at > now() - interval '7 days')::integer AS active_users,
   (SELECT count(*) FROM works WHERE works.published_at > now() - interval '7 days')::integer AS actions
UNION ALL
 SELECT 'collabs'::text,
   (SELECT count(DISTINCT collab_posts.user_id) FROM collab_posts WHERE collab_posts.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM collab_posts WHERE collab_posts.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'collab_applications'::text,
   (SELECT count(DISTINCT collab_contact_events.sender_user_id) FROM collab_contact_events WHERE collab_contact_events.sent_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM collab_contact_events WHERE collab_contact_events.sent_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'lounge_messages'::text,
   (SELECT count(DISTINCT instant_messages.user_id) FROM instant_messages WHERE instant_messages.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM instant_messages WHERE instant_messages.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'group_today'::text,
   (SELECT count(DISTINCT group_today_posts.author_id) FROM group_today_posts WHERE group_today_posts.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM group_today_posts WHERE group_today_posts.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'blog_posts'::text,
   (SELECT count(DISTINCT blog_posts.created_by) FROM blog_posts WHERE blog_posts.published_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM blog_posts WHERE blog_posts.published_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'group_event_rsvps'::text,
   (SELECT count(DISTINCT group_event_rsvps.user_id) FROM group_event_rsvps WHERE group_event_rsvps.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM group_event_rsvps WHERE group_event_rsvps.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'follows'::text,
   (SELECT count(DISTINCT follows.follower_user_id) FROM follows WHERE follows.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM follows WHERE follows.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'comments'::text,
   (SELECT count(DISTINCT comments.user_id) FROM comments WHERE comments.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM comments WHERE comments.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'dms'::text,
   (SELECT count(DISTINCT messages.sender_id) FROM messages WHERE messages.created_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM messages WHERE messages.created_at > now() - interval '7 days')::integer
UNION ALL
 SELECT 'instant_rooms'::text,
   (SELECT count(DISTINCT instant_presence.user_id) FROM instant_presence WHERE instant_presence.last_seen_at > now() - interval '7 days')::integer,
   (SELECT count(*) FROM instant_presence WHERE instant_presence.last_seen_at > now() - interval '7 days')::integer;

DROP VIEW IF EXISTS public.vw_lounge_funnel;
CREATE VIEW public.vw_lounge_funnel AS
SELECT
  (SELECT count(*) FROM instant_rooms WHERE instant_rooms.created_at > now() - interval '30 days')::integer AS rooms_created_30d,
  (SELECT count(*) FROM instant_rooms WHERE instant_rooms.status = 'active'::instant_status AND instant_rooms.closed_at IS NULL)::integer AS live_now,
  (SELECT count(DISTINCT instant_presence.user_id) FROM instant_presence WHERE instant_presence.last_seen_at > now() - interval '30 days')::integer AS participants_30d,
  (SELECT COALESCE(sum(lounge_audio_daily.minutes), 0) FROM lounge_audio_daily WHERE lounge_audio_daily.day > (now() - interval '30 days')::date)::integer AS audio_minutes_30d,
  (SELECT count(*) FROM instant_messages WHERE instant_messages.created_at > now() - interval '30 days')::integer AS messages_30d;