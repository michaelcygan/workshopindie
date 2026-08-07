-- Wave 15 / Stage B: drop exactly-redundant indexes.
--
-- Each index below duplicates the column list of another index on the same
-- table. The twin that is retained is the one the planner actually chooses
-- (higher idx_scan), or the unique constraint, which can serve the same
-- lookups. Duplicates cost write throughput on every INSERT/UPDATE and inflate
-- planning time (measured at 3.8-23ms on the widest tables).
--
-- No unique constraint is dropped, so no invariant is weakened.

-- events: 20 indexes, the widest table in the app
DROP INDEX IF EXISTS public.idx_group_events_group_starts;   -- = group_events_group_starts_idx (245 scans)
DROP INDEX IF EXISTS public.idx_group_events_series_starts;  -- covered by group_events_series_starts_uidx

-- works: covered by the partial public-feed index that is actually used
DROP INDEX IF EXISTS public.idx_works_published_at;          -- = works_public_feed_idx (8605 scans)

-- presence: hottest write path in the app
DROP INDEX IF EXISTS public.instant_presence_room_idx;       -- prefix of idx_instant_presence_room_lastseen (112k scans)

-- collabs
DROP INDEX IF EXISTS public.idx_collab_posts_created_at;     -- = collab_posts_created_idx

-- workshops
DROP INDEX IF EXISTS public.workshops_city_idx;              -- = idx_workshops_city_id (1287 scans)

-- token lookups already covered by their UNIQUE constraints
DROP INDEX IF EXISTS public.idx_group_seed_links_token;      -- = group_seed_links_token_key
DROP INDEX IF EXISTS public.idx_event_guest_rsvps_claim_token; -- = event_guest_rsvps_claim_token_key
DROP INDEX IF EXISTS public.workshop_links_token_idx;        -- = workshop_links_token_key
DROP INDEX IF EXISTS public.work_agreements_work_idx;        -- = work_agreements_work_id_version_key

-- misc duplicates
DROP INDEX IF EXISTS public.idx_lounge_audio_events_created_at; -- = lounge_audio_events_created_idx
DROP INDEX IF EXISTS public.idx_group_today_pins_group_active;  -- = group_today_pins_group_expires_idx (1028 scans)

ANALYZE public.group_events;
ANALYZE public.works;
ANALYZE public.instant_presence;
ANALYZE public.collab_posts;
ANALYZE public.workshops;
