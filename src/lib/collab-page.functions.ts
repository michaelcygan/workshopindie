/**
 * Server-decided access for the Collab detail page.
 *
 * A Collab whose submissions are paused is private to its members (owner +
 * accepted `collab_invites`). Access is resolved BEFORE any private data is
 * returned, so a paused Collab's title, description, roles or metadata never
 * reach an unauthorized client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


export type CollabDetailRow = {
  id: string;
  title: string | null;
  slug: string;
  category: string | null;
  categories: string[] | null;
  category_canonical: string | null;
  categories_canonical: string[] | null;
  subcategories: string[] | null;
  description: string | null;
  timeline_text: string | null;
  location_mode: string | null;
  compensation_type: string | null;
  contact_mode: string | null;
  external_contact_url: string | null;
  status: string | null;
  applications_open: boolean | null;
  archived_at: string | null;
  created_at: string;
  closed_at: string | null;
  ends_on: string | null;
  resulting_work_id: string | null;
  user_id: string;
  live_workshop_id: string | null;
  rights_arrangement: string | null;
  accepts_suggestions: boolean | null;
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    headline: string | null;
    first_name: string | null;
  } | null;
  city: { name: string | null } | null;
  roles: Array<{
    id: string;
    role_name: string | null;
    quantity: number | null;
    description: string | null;
    sort_order: number | null;
  }>;
};

export type CollabPageResult =
  | { access: "ok"; post: CollabDetailRow; viewerIsMember: boolean }
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

    return { access: "ok", post: row as unknown as CollabDetailRow, viewerIsMember: member };
  });
