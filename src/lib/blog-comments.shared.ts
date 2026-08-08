import { z } from "zod";

/** Client-safe validation/helpers for the lite blog comment system. */

export const blogCommentUuid = z.string().uuid();
export const blogCommentBody = z.string().trim().min(1).max(1000);
export const BLOG_COMMENT_MAX = 1000;
export const BLOG_COMMENT_SPAM = { maxLinks: 4, maxRepeatChars: 25 } as const;

type RpcClient = {
  rpc: (
    fn: "is_blog_post_author",
    args: { _post_id: string; _user_id: string },
  ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
};

/** Server-side author/co-author gate. Never trust a client-supplied owner id. */
export async function assertBlogAuthor(
  supabase: RpcClient,
  postId: string,
  userId: string,
  message: string,
): Promise<void> {
  const { data: isAuthor, error } = await supabase.rpc("is_blog_post_author", {
    _post_id: postId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!isAuthor) throw new Error(message);
}
