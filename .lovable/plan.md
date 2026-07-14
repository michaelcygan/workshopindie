# Comments: owner controls, one-level replies, DM commenter

Keep the model dead simple. No threading beyond a single owner reply. No new "archive" concept — "hidden" already does the job; the owner just gets a toggle to show hidden ones.

## What the owner can do on each comment

On any comment on their own Work, a small `…` menu offers:

1. **Reply** — inline composer opens under the comment; posts a single child comment tagged "Author reply".
2. **Message** — opens (or creates) a DM with the commenter and navigates to `/dms/$id`.
3. **Hide** / **Unhide** — hides the comment from the public thread. The commenter still sees their own comment (with a subtle "Only visible to you — hidden by author" label). The owner sees it dimmed with an "Unhide" action. A "Show hidden (N)" toggle at the top of the thread lets the owner reveal them inline.

Non-owners see none of these controls. Admins keep their existing moderation.

## Data changes

Add two columns to `public.comments`:

- `owner_hidden boolean not null default false` — set by the Work owner.
- `parent_id uuid null references public.comments(id) on delete cascade` — non-null only for the owner's reply. DB check: `parent_id` must point to a comment on the same `work_id` and must itself have `parent_id is null` (enforced in the server fn; a trigger is overkill).

RLS updates on `comments`:

- Replace the public SELECT policy so a row is visible when:
  `not hidden and not owner_hidden`, **OR** viewer is the commenter (`auth.uid() = user_id`), **OR** viewer owns the Work (`exists (select 1 from works w where w.id = work_id and w.created_by = auth.uid())`), plus the existing block-pair check.
- Add an UPDATE policy scoped to the Work owner that only permits toggling `owner_hidden` (enforced by writing through a server fn; policy just gates the row).
- Keep existing insert/delete/edit-own and admin policies.

No new table. No thread depth beyond 1.

## Server functions (new `src/lib/comments.functions.ts`)

All use `requireSupabaseAuth`.

- `setCommentHidden({ commentId, hidden })` — verifies caller owns the Work that the comment belongs to, updates `owner_hidden`.
- `replyToComment({ commentId, body })` — verifies caller owns the Work, verifies parent has `parent_id is null`, inserts a new comment with `work_id`, `user_id = owner`, `parent_id = commentId`, trimmed body (1–1000 chars). Returns the new row.
- DM open reuses existing `openOrCreateConversation` from `src/lib/dms.functions.ts` — no new fn needed.

## UI changes (`src/components/comment-thread.tsx`)

- Extend the query to select `parent_id, owner_hidden` and to fetch the Work's `created_by` once (or pass it in as a prop from `works.$slug.tsx`, which already has it).
- Group rows: top-level (`parent_id is null`) rendered in order; each top-level row renders its single owner reply (if any) indented beneath it with an "Author reply" chip.
- Per comment, if `viewer.id === work.created_by` and the comment isn't the owner's own reply, render a `DropdownMenu` with Reply / Message / Hide (or Unhide).
  - Reply → toggles an inline `Textarea` + Post button; on success invalidates `["comments", workId]`.
  - Message → calls `openOrCreateConversation({ otherUserId: comment.user_id })` then `navigate({ to: "/dms/$conversationId" })`.
  - Hide/Unhide → calls `setCommentHidden`, optimistic update, toast.
- Hidden rendering:
  - Viewer is commenter: show with muted "Only visible to you — hidden by author" note.
  - Viewer is owner: show dimmed with "Hidden" chip + Unhide.
  - Everyone else: filtered out by RLS (nothing to render).
- Top of thread, if `viewer.id === work.created_by` and hidden count > 0: a small `"Show hidden (N)"` / `"Hide hidden"` toggle (client-side filter on already-fetched rows).
- Owner's own reply row hides the Reply/Message/Hide menu (no self-actions); it keeps the existing "delete own comment" affordance if we have one.

## Out of scope

- Threaded replies beyond one owner reply.
- A separate "Archive" state (folded into `owner_hidden`).
- Editing/removing an owner reply via new UI beyond the existing edit-own behavior.
- Notifications wiring changes (owner reply and DM open just piggy-back on existing systems).
