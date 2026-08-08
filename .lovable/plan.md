# Lite Blog Comments

A small, deliberately non-forum comment layer beneath published blog posts: one comment, up/down votes, and at most one author response. Nothing threaded.

## What readers and writers get

- Anyone (signed in or not) reads visible comments, author responses, vote scores and the comment count, and can click through to commenter profiles.
- Signed-in members post a plain-text comment (max 1000 chars), delete their own, report someone else's, and upvote/downvote (clicking the same arrow again clears the vote).
- The post's author or co-author can leave one response under a comment and hide/unhide it. Hidden comments vanish for the public; the author and the original commenter still see them with a quiet "Hidden by author" label.
- Signed-out visitors see "Join the conversation" with a Sign in to comment button instead of a dead textarea.
- Ordering stays oldest-first; votes are social signal only and never reorder anything.

## Findings from the audit

- The existing `comments` table is Work-specific (`work_id`, `parent_id`, `owner_hidden`) and stays completely untouched. Blog comments get their own tables.
- `reports.entity_type` is a plain text column with no enum or check constraint, so adding a `blog_comment` type needs only a widening of the `ReportEntityType` union in `src/components/report-dialog.tsx` — no schema change, no new reporting infrastructure.
- Blog authorship is `blog_posts.author_profile_id`, `blog_posts.created_by`, plus rows in `blog_post_authors(blog_post_id, profile_id)`. `profiles.id` is the auth user id, which is what `comments.user_id` and `reports.reporter_user_id` already use.
- Work comments already establish every pattern to copy: `check_and_bump` rate limiting (8/min), `moderateOrThrow` on the server, `useModerationChecker()` on the client, `requireSupabaseAuth` server functions, and `["comments", workId]` query invalidation.

## Build order

**Wave 1 — Schema.** One migration creating `blog_comments` (post ref cascade-delete, `user_id`, `body`, `author_reply`, `author_reply_by`, `author_replied_at`, `hidden`, `created_at`) with length checks 1–1000 on body and reply, and `blog_comment_votes` (`comment_id`, `user_id`, `value` in (-1,1), primary key on the pair so duplicate votes are structurally impossible). Indexes on `(blog_post_id, created_at)`, `user_id`, `comment_id`. Grants for `anon` (read only), `authenticated` and `service_role`, RLS on, and a `SECURITY DEFINER` helper `public.is_blog_post_author(post_id, user_id)` recognising creator, primary author profile and co-authors. Policies: public read of non-hidden comments on published posts; owner and post authors also read hidden ones; authenticated insert-own; delete-own; author-only update; votes readable only to their owner and writable only as self. Then regenerate Supabase types.

**Wave 1b — Vote privacy.** A `SECURITY DEFINER` function `get_blog_comment_vote_summary(blog_post_id)` returning `comment_id, score, viewer_vote` so no raw voter list is ever public. One call per article, not per comment.

**Wave 2 — Server functions** in a new `src/lib/blog-comments.functions.ts`, all behind `requireSupabaseAuth` with Zod validation: `postBlogComment` (rate key `blog_comment_post`, 8/min, verifies the post exists and is published, `moderateOrThrow` surface `blog.comment`), `replyToBlogComment` (author check server-side, surface `blog.comment.author_reply`, writes the three reply columns on the same row), `setBlogCommentHidden` (author check), `deleteBlogComment` (commenter only), `setBlogCommentVote` (upsert/delete with the toggle rules). Every author check goes through the shared helper; no client-supplied owner ids are trusted.

**Wave 3 — Read UI.** New `src/components/blog-comments.tsx`, visually modelled on the Work thread but simpler: heading with count, avatar, name link, relative timestamp, plain-text body, quiet `↑ 6 ↓` row, and the author response as a small left-inset block labelled "· Author". Read path first, capped at 50 comments.

**Wave 4 — Participation.** Composer with inline moderation errors and toast fallback, the kebab menu (Delete / Report / Reply as author / Hide / Unhide by role), vote buttons, and scoped invalidation of `["blog-comments", postId]` and `["blog-comment-votes", postId]` only.

**Wave 5 — Article integration.** Add `<BlogComments postId={post.id} />` between `ShareRow` and `BlogArticleFooter` in `src/routes/blog.$slug.tsx`. Nothing else on that route changes — body renderer, head metadata, author header, context block, share row and footer stay byte-identical.

**Wave 6 — Verification.** Run through the read/post/delete/reply/hide/vote matrix signed out, as a reader, as the commenter and as a co-author; attempt unauthorised direct calls; confirm hidden comments never reach an anonymous session; then regression-check Work comments (render, post, owner reply, hide, DM action, moderation) and the blog route's SEO output.

## Technical notes

- `author_reply` lives on the comment row rather than a child table, so "one author response, no reply chains" is enforced by the shape of the data, not by UI discipline.
- Deleting a blog post cascades to comments, and deleting a comment cascades to its votes.
- No realtime, no notifications, no sorting controls, no comment counts on blog cards, no pagination beyond the 50-row cap.
- Existing Work comment code and the `comments` table are not edited; the only touched shared file is the `ReportEntityType` union.
