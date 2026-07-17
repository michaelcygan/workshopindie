## Goal
Extend the DM "Re: …" context tag that already exists for Collabs and Workshops to also cover **Works** and **Comments**, and wire up the entry-point Message buttons that pass that context. Recipients will see a clickable pill like "Re: {Work title}" or "Re: comment on {Work title}" at the top of the DM thread that jumps back to the source.

## Current state (already shipped, don't rebuild)
- `conversations.context_collab_post_id` and `conversations.context_workshop_id` columns exist.
- `openOrCreateConversation` (in `src/lib/dms.functions.ts`) accepts and stores those two context IDs on first insert.
- `src/routes/dms.$conversationId.tsx` header already renders a "Re: {title}" pill for both, linking back to `/collab/$slug` or `/workshops/$slug`.
- `<MessageButton>` on `collab.$slug.tsx` and `workshops.$slug.tsx` already passes the right context prop.

## What's missing
- No Work context. No Comment context. No Message button on the Work page or on comment authors.

## Plan

### 1. Database migration
Add two nullable context columns to `conversations` (same pattern as workshop migration):
- `context_work_id uuid REFERENCES public.works(id) ON DELETE SET NULL`
- `context_comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL`
Add matching indexes. No RLS/GRANT changes (columns inherit table policies).

### 2. Server function — `src/lib/dms.functions.ts`
Extend `openOrCreateConversation`:
- Add `contextWorkId?: string | null` and `contextCommentId?: string | null` to the input validator.
- Include them in the initial `insertRow` when the conversation is created (existing behavior: never overwrite context on an existing conversation — same as collab/workshop today).

### 3. `<MessageButton>` — `src/components/message-button.tsx`
Add two optional props: `contextWorkId`, `contextCommentId`. Pass them through to `openOrCreateConversation`. No visual change to the button.

### 4. DM header — `src/routes/dms.$conversationId.tsx`
- Extend the initial fetch to also select `context_work_id, context_comment_id`, and load the referenced Work (title, slug) and Comment (id, body preview, and its parent Work slug/title so we can link back).
- Extend the header pill block (currently a single collab-or-workshop ternary) into a small `ContextPill` that renders one of:
  - Collab → "Re: {title}" → `/collab/$slug` (existing)
  - Workshop → "Re: {title}" → `/workshops/$slug` (existing)
  - Work → "Re: {title}" → `/works/$slug` (new)
  - Comment → "Re: comment on {work title}" → `/works/$slug#comment-{id}` (new)
- Keep the same rounded-pill visual language; use `bg-primary/10` for Collab/Work and `bg-violet/10` for Workshop/Comment so the tag reads as an at-a-glance source badge.

### 5. Message buttons on new surfaces
- **Work page (`src/routes/works.$slug.tsx`)**: add a `<MessageButton otherUserId={author.id} contextWorkId={work.id} />` next to the author's name/actions row (only shown when not the owner — the component already gates on mutual-follow / open-DM permission).
- **Comments**: locate the comment card renderer used on Works (and on Collabs if it's shared) and add a `<MessageButton otherUserId={comment.author_id} contextCommentId={comment.id} />` inline in the author's meta row, again gated by the component's existing DM permission check.
  - I'll confirm the exact comment component during implementation; if none exists as a shared component, the button goes into whichever component renders the comment author line on the Work page.

### 6. Fallback anchor for comment jump
Ensure the comment list on `/works/$slug` renders each comment with `id="comment-{id}"` so the "Re: comment on …" pill link scrolls to the exact comment. Add the `id` attribute if not already present.

## Explicitly out of scope
- Per-message context tags on individual bubbles (the annotated circles). The header pill covers "why this DM exists" for the whole thread; per-message context would require a schema change on `messages` and a larger UI refactor — happy to do it as a follow-up if you want it.
- Retroactive context for conversations that already exist without a context row.
- Notifications copy changes.

## Verification
- Start a new DM from a Work → recipient sees "Re: {Work title}" pill linking to the Work.
- Reply to a comment via the new Message button → recipient sees "Re: comment on {Work title}" pill that scrolls to the exact comment.
- Existing Collab/Workshop DMs continue to render their pills unchanged.
