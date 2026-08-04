GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, city_id, headline, bio,
  categories, external_links, creator_status, pinned_work_ids, work_count,
  follower_count, following_count, worked_with_count, created_at, updated_at,
  instagram_handle, home_city_id, aliases, mediums, tools, discoverable,
  indexable, hide_group_memberships, event_visibility, show_online,
  artist_statement, cover_work_id, alias_urls, languages
) ON public.profiles TO anon;