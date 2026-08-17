/**
 * The exact column list every surface must fetch to render a <CollabCard />.
 *
 * The card derives its lifecycle + recruitment badge from the record itself,
 * so a missing column silently degrades to the closed state ("Not accepting").
 * Keep this list as the single source of truth.
 */
export const COLLAB_CARD_SELECT =
  "id,user_id,title,slug,category,categories,description,timeline_text,timeline_mode,starts_on,ends_on,location_mode,compensation_type,status,created_at,live_workshop_id,resulting_work_id,archived_at,applications_open,accepts_suggestions,city_id,also_cities," +
  "user:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url,city_id,city:cities!profiles_city_id_fkey(name))," +
  "city:cities!collab_posts_city_id_fkey(name)," +
  "roles:collab_roles(id,role_name,sort_order)";

/** Fields the lifecycle/recruitment helpers read; all must be selected. */
export const COLLAB_LIFECYCLE_FIELDS = [
  "status",
  "archived_at",
  "resulting_work_id",
  "applications_open",
  "ends_on",
] as const;
