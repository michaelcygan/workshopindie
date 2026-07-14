-- Lock down anon PII exposure on public.profiles.
-- Strategy: create a safe public_profiles VIEW and revoke sensitive columns
-- from the anon role on the base table via column-level privileges.
-- Authenticated users keep full access (RLS still applies).

-- 1) Safe public view — only columns intended for public consumption.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT
  id, username, display_name, avatar_url, cover_url, city_id, home_city_id,
  headline, bio, artist_statement, categories, mediums, tools, external_links,
  instagram_handle, creator_status, pinned_work_ids, cover_work_id,
  work_count, follower_count, following_count, worked_with_count,
  aliases, discoverable, indexable, hide_group_memberships,
  event_visibility, show_online, dm_policy, preferred_language,
  onboarded, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Column-level privileges on the base table: revoke everything from anon,
-- then re-grant only safe columns. Authenticated + service_role unchanged.
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, home_city_id,
  headline, bio, artist_statement, categories, mediums, tools, external_links,
  instagram_handle, creator_status, pinned_work_ids, cover_work_id,
  work_count, follower_count, following_count, worked_with_count,
  first_name, last_name, aliases, discoverable, indexable,
  hide_group_memberships, event_visibility, show_online, dm_policy,
  preferred_language, onboarded, created_at, updated_at
) ON public.profiles TO anon;

-- Sensitive columns NOT granted to anon:
--   birthdate, age_filter_min, deletion_requested_at, deleted_at,
--   last_active_at, home_city_changed_at, tour_completed_at, referred_by,
--   cc_consent_ack, cc_consent_ack_at
-- Signed-in users continue to read the full row via the existing
-- "profiles public read" policy (which now effectively applies to
-- authenticated only, since anon has no table-level SELECT privilege).