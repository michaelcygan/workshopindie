-- Restrict anon column-level SELECT on profiles: drop birthdate and legal name
-- from public reads. Keep instagram_handle and home_city_id public for discovery.
REVOKE SELECT ON public.profiles FROM anon;

GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, home_city_id,
  headline, bio, artist_statement, categories, mediums, tools, external_links,
  instagram_handle, creator_status, pinned_work_ids, cover_work_id,
  work_count, follower_count, following_count, worked_with_count,
  aliases, discoverable, indexable,
  hide_group_memberships, event_visibility, show_online, dm_policy,
  preferred_language, onboarded, created_at, updated_at
) ON public.profiles TO anon;

-- Also project the public view to match (drop birthdate/legal name if present).
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