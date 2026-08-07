-- =============================================================================
-- Workshop — query shapes to measure
--
-- These are the statements pg_stat_statements ranked highest by total time,
-- reconstructed with concrete values so they can actually be EXPLAINed.
-- Run this against a seeded scratch database and compare the plans to the
-- baselines recorded in docs/scale-report.md.
--
--   psql "$SCALE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/scale/explain-shapes.sql \
--     > /tmp/plans-after.txt
--
-- What to look for, in order of seriousness:
--   1. Seq Scan on a large table in a request path
--   2. Sort without an index backing the ORDER BY (spills to disk)
--   3. Execution Time growing faster than row count
--   4. Planning Time above ~2ms — usually too many indexes on the table
-- =============================================================================

\timing on
\pset pager off

\echo '=== 1. Blog index feed (public, highest-traffic read) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug, excerpt, cover_image_url, author_name, published_at,
       created_by, author_profile_id, publication_type
FROM public.blog_posts
WHERE status = 'published' AND show_in_blog_index = true AND published_at <= now()
ORDER BY published_at DESC
LIMIT 24 OFFSET 0;

\echo '=== 2. Blog feed, deep page (offset pagination degrades linearly) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug, published_at
FROM public.blog_posts
WHERE status = 'published' AND show_in_blog_index = true
ORDER BY published_at DESC NULLS LAST
LIMIT 24 OFFSET 5000;

\echo '=== 3. Notification bell (per signed-in user, every page load) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, kind, actor_user_id, entity_type, entity_id, payload, read_at, created_at
FROM public.notifications
WHERE user_id = (SELECT id FROM public.profiles ORDER BY random() LIMIT 1)
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

\echo '=== 4. Presence read for a room (polled by every participant) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT user_id
FROM public.instant_presence
WHERE room_id = (SELECT id FROM public.instant_rooms ORDER BY random() LIMIT 1)
  AND last_seen_at > now() - interval '2 minutes';

\echo '=== 5. Profile lookup by username (the canonical creator URL) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, username, display_name, avatar_url, headline, bio
FROM public.profiles
WHERE username = (SELECT username FROM public.profiles WHERE username IS NOT NULL ORDER BY random() LIMIT 1);

\echo '=== 6. Upcoming public events (events directory) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug, starts_at, group_id
FROM public.group_events
WHERE status = 'scheduled' AND visibility = 'public'
  AND deleted_at IS NULL AND starts_at > now()
ORDER BY starts_at ASC
LIMIT 40;

\echo '=== 7. Published works feed (home + galleries) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, slug, cover_url, category, published_at
FROM public.works
WHERE status = 'published'
ORDER BY published_at DESC NULLS LAST
LIMIT 24;

\echo '=== 8. Mutual-follow resolution (presence "came online" fan-out) ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT f1.followed_user_id
FROM public.follows f1
JOIN public.follows f2
  ON f2.follower_user_id = f1.followed_user_id
 AND f2.followed_user_id = f1.follower_user_id
WHERE f1.follower_user_id = (SELECT id FROM public.profiles ORDER BY random() LIMIT 1);

\echo '=== Index inventory: planning cost and write cost live here ==='
SELECT relname AS table_name,
       count(*) AS indexes,
       count(*) FILTER (WHERE idx_scan = 0) AS never_used,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS index_bytes
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
GROUP BY relname
HAVING count(*) >= 5
ORDER BY count(*) DESC;

\echo '=== Sequential scans on large tables: each one is a candidate index ==='
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 10000 AND seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 20;
