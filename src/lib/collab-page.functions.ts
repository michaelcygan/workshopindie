/**
 * Server-decided access for the Collab detail page.
 *
 * A Collab whose submissions are paused is private to its members (owner +
 * accepted `collab_invites`). Access is resolved BEFORE any private data is
 * returned, so a paused Collab's title, description, roles or metadata never
 * reach an unauthorized client.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isPubliclyVisible } from "@/lib/collab/lifecycle";

const slugSchema = z.string().trim().min(1).max(200);

/** Signed-in user id from the bearer token, when one is present. */
export async function viewerIdFromRequest(): Promise<string | null> {
  const auth = getRequestHeader("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user?.id ?? null;
}

/** Owner or accepted member of this Collab. Mirrors `public.is_collab_member`. */
export async function isCollabMember(collabPostId: string, ownerId: string | null, viewerId: string | null) {
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

const DETAIL_SELECT =
  "id,title,slug,category,categories,category_canonical,categories_canonical,subcategories,description,timeline_text,location_mode,compensation_type,contact_mode,external_contact_url,status,applications_open,archived_at,created_at,closed_at,ends_on,resulting_work_id,user_id,live_workshop_id,rights_arrangement,accepts_suggestions," +
  "user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url,headline,first_name)," +
  "city:cities!collab_posts_city_id_fkey(name)," +
  "roles:collab_roles(id,role_name,quantity,description,sort_order)";

export type CollabPageResult =
  | { access: "ok"; post: Record<string, unknown>; viewerIsMember: boolean }
  | { access: "unavailable" };

/**
 * Anonymous-callable. Returns the full Collab only when the viewer may see it:
 * publicly visible, or the viewer is its owner / an accepted member.
 */
export const getCollabPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slugSchema.parse(d.slug) }))
  .handler(async ({ data }): Promise<CollabPageResult> => {
    const { data: row } = await supabaseAdmin
      .from("collab_posts")
      .select(DETAIL_SELECT)
      .eq("slug", data.slug)
      .maybeSingle();
    if (!row) return { access: "unavailable" };

    const record = row as unknown as {
      id: string;
      user_id: string | null;
      status: string | null;
      archived_at: string | null;
      resulting_work_id: string | null;
      applications_open: boolean | null;
      ends_on: string | null;
    };

    const viewerId = await viewerIdFromRequest();
    const member = await isCollabMember(record.id, record.user_id, viewerId);
    if (!member && !isPubliclyVisible(record)) return { access: "unavailable" };

    return { access: "ok", post: row as unknown as Record<string, unknown>, viewerIsMember: member };
  });
