import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertBlogAuthor,
  blogCommentBody,
  blogCommentUuid as uuid,
  BLOG_COMMENT_SPAM,
} from "@/lib/blog-comments.shared";

/**
 * Lite blog comments: one comment, optional single author response, up/down votes.
 * Deliberately separate from the Work comment system (`comments` table).
 */

export const postBlogComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; body: string }) => ({
    postId: uuid.parse(d.postId),
    body: blogCommentBody.parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "blog_comment_post",
      _key: userId,
      _window_s: 60,
      _max: 8,
    });
    if (ok === false) throw new Error("You're commenting too fast. Please wait a moment.");

    const { data: published, error: pErr } = await supabase.rpc("blog_post_is_published", {
      _post_id: data.postId,
    });
    if (pErr) throw new Error(pErr.message);
    if (!published) throw new Error("This article isn't accepting comments.");

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    await moderateOrThrow({
      userId,
      surface: "blog.comment",
      subjectId: data.postId,
      text: data.body,
      spam: { ...BLOG_COMMENT_SPAM },
    });

    const { data: inserted, error } = await supabase
      .from("blog_comments")
      .insert({ blog_post_id: data.postId, user_id: userId, body: data.body })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const deleteBlogComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string }) => ({ commentId: uuid.parse(d.commentId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error: cErr } = await supabase
      .from("blog_comments")
      .select("id,user_id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found.");
    if (c.user_id !== userId) throw new Error("You can only delete your own comment.");

    const { error } = await supabase
      .from("blog_comments")
      .delete()
      .eq("id", data.commentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToBlogComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string; body: string }) => ({
    commentId: uuid.parse(d.commentId),
    body: blogCommentBody.parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error: cErr } = await supabase
      .from("blog_comments")
      .select("id,blog_post_id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found.");

    await assertBlogAuthor(supabase, c.blog_post_id, userId, "Only an article author can reply here.");

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    await moderateOrThrow({
      userId,
      surface: "blog.comment.author_reply",
      subjectId: c.blog_post_id,
      text: data.body,
      spam: { ...BLOG_COMMENT_SPAM },
    });

    const { error } = await supabase
      .from("blog_comments")
      .update({
        author_reply: data.body,
        author_reply_by: userId,
        author_replied_at: new Date().toISOString(),
      })
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearBlogCommentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string }) => ({ commentId: uuid.parse(d.commentId) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error: cErr } = await supabase
      .from("blog_comments")
      .select("id,blog_post_id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found.");
    await assertBlogAuthor(
      supabase,
      c.blog_post_id,
      userId,
      "Only an article author can remove this response.",
    );

    const { error } = await supabase
      .from("blog_comments")
      .update({ author_reply: null, author_reply_by: null, author_replied_at: null })
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBlogCommentHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string; hidden: boolean }) => ({
    commentId: uuid.parse(d.commentId),
    hidden: z.boolean().parse(d.hidden),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c, error: cErr } = await supabase
      .from("blog_comments")
      .select("id,blog_post_id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found.");
    await assertBlogAuthor(
      supabase,
      c.blog_post_id,
      userId,
      "Only an article author can hide comments.",
    );

    const { error } = await supabase
      .from("blog_comments")
      .update({ hidden: data.hidden })
      .eq("id", data.commentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBlogCommentVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commentId: string; value: number }) => ({
    commentId: uuid.parse(d.commentId),
    value: z.union([z.literal(-1), z.literal(0), z.literal(1)]).parse(d.value),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ok } = await supabase.rpc("check_and_bump", {
      _action: "blog_comment_vote",
      _key: userId,
      _window_s: 60,
      _max: 60,
    });
    if (ok === false) throw new Error("You're voting too fast. Please wait a moment.");

    const { data: c, error: cErr } = await supabase
      .from("blog_comments")
      .select("id")
      .eq("id", data.commentId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Comment not found.");

    if (data.value === 0) {
      const { error } = await supabase
        .from("blog_comment_votes")
        .delete()
        .eq("comment_id", data.commentId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { ok: true, value: 0 };
    }

    const { error } = await supabase
      .from("blog_comment_votes")
      .upsert(
        { comment_id: data.commentId, user_id: userId, value: data.value },
        { onConflict: "comment_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, value: data.value };
  });
