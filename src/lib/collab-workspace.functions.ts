import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { findBlockedUrl } from "@/lib/moderation/url-blocklist";
import { normalizeUrl } from "@/lib/url-normalize";

/* ─── Messages ──────────────────────────────────────────────────────── */

export const listCollabMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(input),
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
    const { sendCollabMessage } = await import("@/lib/messaging/pipeline.server");
    return sendCollabMessage({ supabase, userId, subjectId: data.collabPostId }, data.body);
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
      .select("collab_post_id,meeting_url,files_url,next_meeting_at,updated_at,updated_by")
      .eq("collab_post_id", data.collabPostId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

/** Owner-only: the shared project folder link (Drive, Dropbox, anything). */
export const setCollabFilesUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        filesUrl: z.string().trim().max(500).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let normalized: string | null = null;
    if (data.filesUrl && data.filesUrl.length > 0) {
      normalized = normalizeUrl(data.filesUrl);
      if (!normalized) throw new Error("That doesn't look like a valid URL.");
      if (findBlockedUrl(normalized)) throw new Error("That link isn't allowed here.");
    }

    // RLS restricts writes to the Collab owner.
    const { error } = await supabase.from("collab_workspace_settings").upsert(
      {
        collab_post_id: data.collabPostId,
        files_url: normalized,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "collab_post_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, filesUrl: normalized };
  });

/** Owner-only: the next meeting time, stored UTC. Null clears it. */
export const setCollabNextMeetingAt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        collabPostId: z.string().uuid(),
        nextMeetingAt: z.string().trim().min(1).max(64).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let iso: string | null = null;
    if (data.nextMeetingAt) {
      const d = new Date(data.nextMeetingAt);
      if (Number.isNaN(d.getTime())) throw new Error("That doesn't look like a valid date and time.");
      iso = d.toISOString();
    }

    const { error } = await supabase.from("collab_workspace_settings").upsert(
      {
        collab_post_id: data.collabPostId,
        next_meeting_at: iso,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "collab_post_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const, nextMeetingAt: iso };
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
    const { error } = await supabase.from("collab_workspace_settings").upsert(
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
