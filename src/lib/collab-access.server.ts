/**
 * Server-only helpers for deciding who may read a Collab.
 *
 * A paused Collab (in progress, `applications_open = false`) is private to its
 * members: the owner and users with an accepted `collab_invites` row. This
 * mirrors the `public.is_collab_member` database function — there is no second
 * membership model.
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Signed-in user id from the request bearer token, when one is present. */
export async function viewerIdFromRequest(): Promise<string | null> {
  const auth = getRequestHeader("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

/** Owner or accepted member of this Collab. */
export async function isCollabMemberServer(
  collabPostId: string,
  ownerId: string | null,
  viewerId: string | null,
): Promise<boolean> {
  if (!viewerId) return false;
  if (ownerId && ownerId === viewerId) return true;
  const { data } = await supabaseAdmin
    .from("collab_invites")
    .select("id")
    .eq("collab_post_id", collabPostId)
    .eq("invitee_user_id", viewerId)
    .eq("status", "accepted")
    .maybeSingle();
  return !!data;
}

export const COLLAB_DETAIL_SELECT =
  "id,title,slug,category,categories,category_canonical,categories_canonical,subcategories,description,timeline_text,location_mode,compensation_type,contact_mode,external_contact_url,status,applications_open,archived_at,created_at,closed_at,ends_on,resulting_work_id,user_id,live_workshop_id,rights_arrangement,accepts_suggestions," +
  "user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url,headline,first_name)," +
  "city:cities!collab_posts_city_id_fkey(name)," +
  "roles:collab_roles(id,role_name,quantity,description,sort_order)";
