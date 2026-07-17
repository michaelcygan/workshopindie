-- Owner-only birthdate: revoke direct SELECT on the birthdate column from
-- anon and authenticated by dropping the table-level SELECT grant and
-- granting SELECT only on every non-sensitive column. Owner reads/writes
-- still go through server functions that use the service role.

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, headline, bio,
  categories, external_links, creator_status, pinned_work_ids, work_count,
  follower_count, following_count, worked_with_count, onboarded, created_at,
  updated_at, first_name, last_name, instagram_handle, home_city_id,
  home_city_changed_at, tour_completed_at, age_filter_min, aliases, mediums,
  tools, referred_by, dm_policy, discoverable, indexable, deleted_at,
  hide_group_memberships, event_visibility, last_active_at, show_online,
  cc_consent_ack, cc_consent_ack_at, preferred_language,
  deletion_requested_at, artist_statement, cover_work_id, alias_urls
) ON public.profiles TO anon, authenticated;
