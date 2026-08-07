import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FREE_PUBLISHED_WORK_CAP } from "@/lib/entitlements";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .url()
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Must be a valid URL");

const publishSchema = z.object({
  collabPostId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  coverUrl: httpsUrl.optional().or(z.literal("")).nullable(),
  primaryUrl: httpsUrl.optional().or(z.literal("")),
  creditedUserIds: z.array(z.string().uuid()).max(50).default([]),
  extraCredits: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        role: z.string().trim().max(80).optional(),
      }),
    )
    .max(20)
    .default([]),
});

/**
 * Publish a Work that came out of a Collab, in one server roundtrip.
 * - Verifies the caller owns the collab.
 * - Inserts the Work with source_type='collab_board' + source_collab_post_id linkage.
 * - Credits the host + every selected applicant (members), with role_label
 *   derived from the role they applied to when available.
 * - Marks the collab as closed and stamps resulting_work_id so the public
 *   page and the /me nudge both update in one shot.
 */
export const publishWorkFromCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => publishSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate limit: 10 publishes / hour per user
    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "work_publish",
      _key: userId,
      _window_s: 3600,
      _max: 10,
    });
    if (ok === false) throw new Error("You're publishing too fast. Try again later.");

    // Quota check: Free users are capped at FREE_PUBLISHED_WORK_CAP published Works.
    const { count: publishedCount } = await supabase
      .from("works")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("status", "published");
    if ((publishedCount ?? 0) >= FREE_PUBLISHED_WORK_CAP) {
      throw new Error("Free tier work limit reached");
    }

    // One atomic transaction: create the Work, credit the team, notify
    // collaborators and flip the Collab to Published. Either all of it
    // lands or none of it does — no half-published Collabs.
    const { data: result, error } = await supabase.rpc("publish_work_from_collab", {
      _collab: data.collabPostId,
      _title: data.title.trim(),
      _description: data.description?.trim() || null,
      _cover_url: data.coverUrl || null,
      _primary_url: data.primaryUrl || null,
      _category: null,
      _credited_user_ids: Array.from(new Set(data.creditedUserIds.filter((id) => id !== userId))),
      _extra_credits: data.extraCredits,
      // The RPC accepts NULLs and falls back to the Collab's own values;
      // generated types mark these params as required non-null.
    } as never);
    if (error) throw new Error(error.message);

    const payload = (result ?? {}) as { work_id?: string; work_slug?: string };
    if (!payload.work_id || !payload.work_slug) throw new Error("Could not publish Work.");
    return { ok: true as const, workSlug: payload.work_slug, workId: payload.work_id };
  });

const closeSchema = z.object({ collabPostId: z.string().uuid() });

/**
 * Pause or resume submissions. Recruiting is independent of lifecycle state —
 * pausing never moves a Collab out of In Progress.
 */
export const setCollabApplicationsOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closeSchema.extend({ open: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("collab_posts")
      .select("resulting_work_id,archived_at")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (data.open && post?.resulting_work_id) {
      throw new Error("This Collab already published its Work.");
    }
    if (data.open && post?.archived_at) {
      throw new Error("Unarchive this Collab before reopening submissions.");
    }
    const { error } = await context.supabase
      .from("collab_posts")
      .update({
        applications_open: data.open,
        closed_at: data.open ? null : new Date().toISOString(),
      })
      .eq("id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Archive / unarchive — an owner management state, not a creative phase. */
export const setCollabArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closeSchema.extend({ archived: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collab_posts")
      .update({
        archived_at: data.archived ? new Date().toISOString() : null,
        ...(data.archived ? { applications_open: false } : {}),
      })
      .eq("id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const dismissPublishNudge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collab_posts")
      .update({ close_nudge_dismissed_at: new Date().toISOString() })
      .eq("id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const extendSchema = z.object({
  collabPostId: z.string().uuid(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
});

/**
 * Owner-only: push the deadline on an open collab. Used by the
 * deadline-reached nudge so users can extend without leaving the page.
 */
export const extendCollabDeadline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => extendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (data.endsOn < today) throw new Error("Pick a future date.");
    const { error } = await context.supabase
      .from("collab_posts")
      .update({ ends_on: data.endsOn })
      .eq("id", data.collabPostId)
      .eq("user_id", context.userId)
      .is("archived_at", null)
      .is("resulting_work_id", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
