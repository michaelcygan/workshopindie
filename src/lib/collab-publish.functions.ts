import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const httpsUrl = z.string().trim().max(500).url().refine(
  (u) => u.startsWith("https://") || u.startsWith("http://"),
  "Must be a valid URL",
);

const publishSchema = z.object({
  collabPostId: z.string().uuid(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  coverUrl: httpsUrl.optional().or(z.literal("")).nullable(),
  primaryUrl: httpsUrl.optional().or(z.literal("")),
  creditedUserIds: z.array(z.string().uuid()).max(50).default([]),
  extraCredits: z
    .array(z.object({ name: z.string().trim().min(1).max(80), role: z.string().trim().max(80).optional() }))
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

    // 1) Load the collab + verify ownership.
    const { data: post, error: postErr } = await supabase
      .from("collab_posts")
      .select("id,user_id,category,description,title,resulting_work_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (postErr) throw new Error(postErr.message);
    if (!post) throw new Error("Collab not found.");
    if (post.user_id !== userId) throw new Error("Only the host can publish a Work from this collab.");
    if (post.resulting_work_id) throw new Error("A Work has already been published from this collab.");

    // 2) Insert the Work. Trigger generates the slug + published_at stamp.
    const { data: work, error: workErr } = await supabase
      .from("works")
      .insert({
        title: data.title.trim(),
        slug: "",
        category: post.category,
        description: (data.description?.trim() || post.description) ?? null,
        cover_url: data.coverUrl || null,
        primary_url: data.primaryUrl || null,
        source_type: "collab_board",
        source_collab_post_id: post.id,
        status: "published",
        visibility: "public",
        license_type: "cc_by",
        created_by: userId,
      })
      .select("id,slug")
      .single();
    if (workErr || !work) throw new Error(workErr?.message ?? "Could not publish Work.");

    // 3) Build the credits ledger. Host first as Creator, then each
    //    selected member with the role they applied to (best-effort lookup),
    //    then any free-text non-member credits.
    const creditedIds = Array.from(new Set(data.creditedUserIds.filter((id) => id !== userId)));

    let roleByUser: Record<string, string> = {};
    if (creditedIds.length > 0) {
      const { data: events } = await supabase
        .from("collab_contact_events")
        .select("sender_user_id, collab_role_id, sent_at, role:collab_roles!collab_contact_events_collab_role_id_fkey(role_name)")
        .eq("collab_post_id", post.id)
        .in("sender_user_id", creditedIds)
        .order("sent_at", { ascending: true });
      for (const ev of (events ?? []) as { sender_user_id: string; role: { role_name: string } | null }[]) {
        if (ev.role?.role_name && !roleByUser[ev.sender_user_id]) {
          roleByUser[ev.sender_user_id] = ev.role.role_name;
        }
      }
    }

    const creditRows: { work_id: string; user_id: string; role_label: string; sort_order: number }[] = [];
    creditRows.push({ work_id: work.id, user_id: userId, role_label: "Creator", sort_order: 0 });
    creditedIds.forEach((uid, idx) => {
      creditRows.push({
        work_id: work.id,
        user_id: uid,
        role_label: roleByUser[uid] ?? "Collaborator",
        sort_order: idx + 1,
      });
    });

    if (creditRows.length > 0) {
      const { error: credErr } = await supabase.from("work_credits").insert(creditRows);
      if (credErr) throw new Error(credErr.message);
    }

    // 4) Close the collab and link the Work back.
    const { error: closeErr } = await supabase
      .from("collab_posts")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        resulting_work_id: work.id,
      })
      .eq("id", post.id);
    if (closeErr) throw new Error(closeErr.message);

    return { ok: true as const, workSlug: work.slug, workId: work.id };
  });

const closeSchema = z.object({ collabPostId: z.string().uuid() });

export const closeCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collab_posts")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const reopenCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => closeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("collab_posts")
      .select("resulting_work_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (post?.resulting_work_id) {
      throw new Error("This collab already produced a Work — reopening would break the link.");
    }
    const { error } = await context.supabase
      .from("collab_posts")
      .update({ status: "open", closed_at: null })
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
