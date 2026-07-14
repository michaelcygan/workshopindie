import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workId: string; body: string }) => ({
    workId: uuid.parse(d.workId),
    body: z.string().trim().min(1).max(1000).parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Rate-limit: 8/min per user
    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "comment_post",
      _key: userId,
      _window_s: 60,
      _max: 8,
    });
    if (ok === false) throw new Error("You're commenting too fast. Please wait a moment.");

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    await moderateOrThrow({
      userId,
      surface: "work.comment",
      subjectId: data.workId,
      text: data.body,
      spam: { maxLinks: 4, maxRepeatChars: 25 },
    });

    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({ user_id: userId, work_id: data.workId, body: data.body })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });


export const setCommentHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string; hidden: boolean }) => ({
    commentId: uuid.parse(d.commentId),
    hidden: z.boolean().parse(d.hidden),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Load the comment + work owner check
    const { data: c, error: cErr } = await supabase
      .from("comments")
      .select("id, work_id, works!inner(created_by)")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found");
    const ownerId = (c as unknown as { works: { created_by: string } }).works.created_by;
    if (ownerId !== userId) throw new Error("Only the work owner can moderate comments");

    const { error } = await supabase
      .from("comments")
      .update({ owner_hidden: data.hidden })
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string; body: string }) => ({
    commentId: uuid.parse(d.commentId),
    body: z.string().trim().min(1).max(1000).parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: parent, error: pErr } = await supabase
      .from("comments")
      .select("id, work_id, parent_id, works!inner(created_by)")
      .eq("id", data.commentId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!parent) throw new Error("Comment not found");
    if (parent.parent_id) throw new Error("Cannot reply to a reply");
    const ownerId = (parent as unknown as { works: { created_by: string } }).works.created_by;
    if (ownerId !== userId) throw new Error("Only the work owner can reply here");

    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({
        work_id: parent.work_id,
        user_id: userId,
        body: data.body,
        parent_id: parent.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });
