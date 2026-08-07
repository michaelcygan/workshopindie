-- =============================================================================
-- Workshop — scale corpus seeder
--
-- Produces a realistic-size dataset so query plans can be measured against
-- something other than a nearly empty database.
--
-- RUN THIS ONLY AGAINST A SCRATCH DATABASE. It writes directly into auth.users,
-- disables triggers, and is not reversible except by dropping the seeded rows
-- (see teardown at the bottom). The guard below aborts if the target looks like
-- production.
--
--   psql "$SCALE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/scale/seed-corpus.sql
--
-- Tunables (override with -v, e.g. -v profiles=10000):
--   profiles      default 50000
--   works         default 200000
--   notifications default 500000
--   events        default 100000
-- =============================================================================

\set ON_ERROR_STOP on
\if :{?profiles}      \else \set profiles 50000       \endif
\if :{?works}         \else \set works 200000         \endif
\if :{?notifications} \else \set notifications 500000 \endif
\if :{?events}        \else \set events 100000        \endif

-- --- Guard: refuse to run anywhere that is not explicitly marked scratch -----
DO $$
BEGIN
  IF current_setting('scale.allow_seed', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION
      'Refusing to seed. Run: ALTER DATABASE <scratch_db> SET scale.allow_seed = ''yes''; first. Never do this on production.';
  END IF;
  IF (SELECT count(*) FROM public.profiles) > 1000 THEN
    RAISE EXCEPTION 'Target already has %, refusing to double-seed.',
      (SELECT count(*) FROM public.profiles);
  END IF;
END $$;

-- Seeded rows are tagged so teardown is exact.
CREATE SCHEMA IF NOT EXISTS scale;
CREATE TABLE IF NOT EXISTS scale.seeded_users (id uuid PRIMARY KEY);

-- Triggers and FK checks are skipped: moderation, medium-group fan-out and
-- notification triggers would each fire hundreds of thousands of times and are
-- not what we are measuring. Read paths do not depend on them having run.
SET session_replication_role = replica;

-- --- Identities --------------------------------------------------------------
WITH gen AS (
  SELECT gen_random_uuid() AS id, i
  FROM generate_series(1, :profiles) i
), ins_auth AS (
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data)
  SELECT id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         format('scale+%s@workshop.test', i), '', now(),
         now() - (random() * interval '400 days'), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  FROM gen
  RETURNING id
)
INSERT INTO scale.seeded_users (id) SELECT id FROM ins_auth;

INSERT INTO public.profiles (id, username, display_name, headline, bio, onboarded,
                             created_at, last_active_at, work_count, follower_count)
SELECT u.id,
       format('scaleuser%s', row_number() OVER (ORDER BY u.id)),
       format('Scale User %s', row_number() OVER (ORDER BY u.id)),
       'Seeded profile for load measurement',
       repeat('Bio paragraph for scale testing. ', 6),
       true,
       now() - (random() * interval '400 days'),
       now() - (random() * interval '30 days'),
       0, 0
FROM scale.seeded_users u
ON CONFLICT (id) DO NOTHING;

-- --- Works -------------------------------------------------------------------
INSERT INTO public.works (id, title, slug, category, created_by, status,
                          excerpt, description, published_at, created_at)
SELECT gen_random_uuid(),
       format('Scale Work %s', i),
       format('scale-work-%s', i),
       (ARRAY['film','music','writing','visual','build']::category[])[1 + (i % 5)],
       (SELECT id FROM scale.seeded_users OFFSET (i % :profiles) LIMIT 1),
       'published'::work_status,
       'A seeded work used to measure query plans at realistic row counts.',
       repeat('Description body for scale testing. ', 12),
       now() - (random() * interval '400 days'),
       now() - (random() * interval '400 days')
FROM generate_series(1, :works) i;

-- --- Notifications (the widest fan-out table) --------------------------------
INSERT INTO public.notifications (id, user_id, kind, entity_type, entity_id,
                                  payload, read_at, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM scale.seeded_users OFFSET (i % :profiles) LIMIT 1),
       (ARRAY['follow','comment','work_published','friend_online'])[1 + (i % 4)],
       'work', gen_random_uuid(), '{}'::jsonb,
       CASE WHEN i % 3 = 0 THEN now() - interval '1 day' ELSE NULL END,
       now() - (random() * interval '120 days')
FROM generate_series(1, :notifications) i;

-- --- Events ------------------------------------------------------------------
INSERT INTO public.group_events (id, group_id, slug, created_by, title,
                                 starts_at, ends_at, status, visibility, created_at)
SELECT gen_random_uuid(),
       (SELECT id FROM public.groups ORDER BY random() LIMIT 1),
       format('scale-event-%s', i),
       (SELECT id FROM scale.seeded_users OFFSET (i % :profiles) LIMIT 1),
       format('Scale Event %s', i),
       now() + ((i % 400) * interval '1 day'),
       now() + ((i % 400) * interval '1 day') + interval '2 hours',
       'scheduled'::group_event_status,
       'public'::group_event_visibility,
       now() - (random() * interval '200 days')
FROM generate_series(1, :events) i;

-- --- Follows: a social graph dense enough to make mutual lookups real --------
INSERT INTO public.follows (follower_user_id, followed_user_id)
SELECT a.id, b.id
FROM scale.seeded_users a
CROSS JOIN LATERAL (
  SELECT id FROM scale.seeded_users ORDER BY random() LIMIT 20
) b
WHERE a.id <> b.id
ON CONFLICT DO NOTHING;

SET session_replication_role = origin;

-- Planner needs fresh statistics or every measurement afterwards is a lie.
ANALYZE public.profiles;
ANALYZE public.works;
ANALYZE public.notifications;
ANALYZE public.group_events;
ANALYZE public.follows;

SELECT 'profiles' AS t, count(*) FROM public.profiles
UNION ALL SELECT 'works', count(*) FROM public.works
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'group_events', count(*) FROM public.group_events
UNION ALL SELECT 'follows', count(*) FROM public.follows;

-- =============================================================================
-- Teardown (run manually when the scratch project is finished with):
--
--   SET session_replication_role = replica;
--   DELETE FROM public.works  WHERE slug LIKE 'scale-work-%';
--   DELETE FROM public.group_events WHERE slug LIKE 'scale-event-%';
--   DELETE FROM public.notifications n USING scale.seeded_users s WHERE n.user_id = s.id;
--   DELETE FROM public.follows f USING scale.seeded_users s WHERE f.follower_user_id = s.id;
--   DELETE FROM public.profiles p USING scale.seeded_users s WHERE p.id = s.id;
--   DELETE FROM auth.users u USING scale.seeded_users s WHERE u.id = s.id;
--   SET session_replication_role = origin;
--   DROP SCHEMA scale CASCADE;
-- =============================================================================
