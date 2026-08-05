/**
 * The Wall: one chronological stream of what happened at an Event.
 *
 * Text posts and photos live in the same feed. The Gallery is not a second
 * feature — it is this same stream filtered to its photos.
 *
 * Everything here is participant-gated by RLS plus an explicit access check,
 * and freezes 24 hours after the Event ends.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SIGNED_URL_TTL = 60 * 60;

export type WallAuthor = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type WallItem = {
  id: string;
  kind: "post" | "photo";
  created_at: string;
  body: string | null;
  image_url: string | null;
  width: number | null;
  height: number | null;
  author: WallAuthor | null;
  can_delete: boolean;
};

export type WallFeed = {
  items: WallItem[];
  can_post: boolean;
  can_view: boolean;
  closes_at: string | null;
  locked_reason: "not_signed_in" | "not_attending" | "closed" | null;
};

const eventInput = z.object({ event_id: z.string().uuid() });

export const listEventWall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => eventInput.parse(i))
  .handler(async ({ data, context }): Promise<WallFeed> => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);

    const closesAt = access.interactionClosesAt ? new Date(access.interactionClosesAt).toISOString() : null;
    const base = {
      can_post: access.canParticipate,
      can_view: access.canSeeRoster,
      closes_at: closesAt,
    };

    if (!access.canSeeRoster) {
      return { ...base, items: [], locked_reason: "not_attending" };
    }

    const [postsRes, photosRes] = await Promise.all([
      supabase
        .from("group_event_comments")
        .select("id,body,created_at,user_id")
        .eq("event_id", data.event_id)
        .is("system_kind", null)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("event_photos")
        .select("id,storage_path,width,height,created_at,uploader_id")
        .eq("event_id", data.event_id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const posts = postsRes.data ?? [];
    const photos = photosRes.data ?? [];

    const paths = photos.map((p) => p.storage_path);
    const signed = paths.length
      ? (await supabase.storage.from("event-photos").createSignedUrls(paths, SIGNED_URL_TTL)).data ?? []
      : [];
    const urlByPath = new Map(signed.map((s) => [s.path ?? "", s.signedUrl ?? null]));

    const ids = Array.from(new Set([...posts.map((p) => p.user_id), ...photos.map((p) => p.uploader_id)]));
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", ids)
      : { data: [] };
    const byId = new Map((profs ?? []).map((p) => [p.id, p]));
    const author = (id: string): WallAuthor | null => {
      const p = byId.get(id);
      return p
        ? { user_id: id, display_name: p.display_name, username: p.username, avatar_url: p.avatar_url }
        : { user_id: id, display_name: null, username: null, avatar_url: null };
    };

    const items: WallItem[] = [
      ...posts.map((p) => ({
        id: p.id,
        kind: "post" as const,
        created_at: p.created_at,
        body: p.body,
        image_url: null,
        width: null,
        height: null,
        author: author(p.user_id),
        can_delete: p.user_id === userId || access.canModerate,
      })),
      ...photos.map((p) => ({
        id: p.id,
        kind: "photo" as const,
        created_at: p.created_at,
        body: null,
        image_url: urlByPath.get(p.storage_path) ?? null,
        width: p.width,
        height: p.height,
        author: author(p.uploader_id),
        can_delete: p.uploader_id === userId || access.canModerate,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      ...base,
      items,
      locked_reason: access.canParticipate ? null : "closed",
    };
  });

export const postToEventWall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ event_id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { requireEventAccess } = await import("@/lib/events/access.server");
    const { access } = await requireEventAccess(supabase, data.event_id, userId);
    if (!access.canParticipate) {
      throw new Error(
        access.isAttending ? "Posting has closed for this Event." : "RSVP to post on this Event's Wall.",
      );
    }
    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    const body = await moderateOrThrow(data.body, { surface: "event_wall", userId });
    const { error } = await supabase
      .from("group_event_comments")
      .insert({ event_id: data.event_id, user_id: userId, body, parent_id: null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWallItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["post", "photo"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.kind === "post") {
      const { error } = await supabase.from("group_event_comments").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { data: row } = await supabase
      .from("event_photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("event_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.storage_path) {
      await supabase.storage.from("event-photos").remove([row.storage_path]);
    }
    return { ok: true };
  });
