import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moderateOrThrow } from "@/lib/moderation/service.server";
import { findBlockedUrl } from "@/lib/moderation/url-blocklist";
import { normalizeUrl } from "@/lib/url-normalize";

/* ─── Messages ──────────────────────────────────────────────────────── */

export const listCollabMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ collabPostId: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("collab_messages")
      .select(
        "id,collab_post_id,author_id,body,created_at,author:profiles!collab_messages_author_id_fkey(id,username,display_name,avatar_url)",
      )
      .eq("collab_post_id", data.collabPostId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const postCollabMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const blocked = findBlockedUrl(data.body);
    if (blocked) {
      throw new Error("That link isn't allowed here.");
    }

    await moderateOrThrow({
      text: data.body,
      userId,
      surface: "collab_messages",
      subjectId: data.collabPostId,
    });

    const { data: row, error } = await supabase
      .from("collab_messages")
      .insert({
        collab_post_id: data.collabPostId,
        author_id: userId,
        body: data.body,
      })
      .select("id,collab_post_id,author_id,body,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCollabMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS restricts to author or collab owner.
    const { error } = await supabase.from("collab_messages").delete().eq("id", data.messageId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ─── Workspace settings (meeting URL) ──────────────────────────────── */

export const getCollabWorkspaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ collabPostId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("collab_workspace_settings")
      .select("collab_post_id,meeting_url,updated_at,updated_by")
      .eq("collab_post_id", data.collabPostId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const setCollabMeetingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        meetingUrl: z.string().trim().max(500).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let normalized: string | null = null;
    if (data.meetingUrl && data.meetingUrl.length > 0) {
      normalized = normalizeUrl(data.meetingUrl);
      if (!normalized) throw new Error("That doesn't look like a valid URL.");
      if (findBlockedUrl(normalized)) throw new Error("That link isn't allowed here.");
    }

    // Upsert. RLS restricts writes to the Collab owner.
    const { error } = await supabase
      .from("collab_workspace_settings")
      .upsert(
        {
          collab_post_id: data.collabPostId,
          meeting_url: normalized,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "collab_post_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const, meetingUrl: normalized };
  });
