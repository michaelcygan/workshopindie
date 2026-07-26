## Workshop Collab Tasks — private lightweight task list

Add a `Chat | Tasks | Links` layout inside the existing private Collab workspace. Chat stays the default. Tasks are visible only to the Collab owner and accepted members, enforced by RLS reusing `public.is_collab_member`.

### Wave 1 — Database & privacy

Migration creating `public.collab_tasks`:
- Columns per spec (id, collab_post_id FK cascade, title, status check-constrained to `todo|in_progress|done`, sort_order, created_by FK profiles, created_at, updated_at, completed_at, title length check).
- Index `(collab_post_id, sort_order, created_at)`.
- `updated_at` trigger using existing shared function.
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`; `GRANT ALL ... TO service_role`; no anon.
- Enable RLS. Policies:
  - SELECT/INSERT/UPDATE: `public.is_collab_member(collab_post_id, auth.uid())` (INSERT also requires `created_by = auth.uid()`).
  - DELETE: `created_by = auth.uid() OR auth.uid() = (SELECT user_id FROM collab_posts WHERE id = collab_post_id)`.
- Add to `supabase_realtime` publication.
- Atomic reorder RPC `reorder_collab_tasks(collab_post_id uuid, ordered_ids uuid[])`, SECURITY INVOKER, validates membership via helper and that all ids belong to the collab, then updates via `unnest ... WITH ORDINALITY`.

### Wave 2 — Server functions

New `src/lib/collab-tasks.functions.ts` with `requireSupabaseAuth` + Zod:
- `listCollabTasks({ collabPostId })` — ordered by sort_order, created_at.
- `createCollabTask({ collabPostId, title })` — trim + moderate via `moderateOrThrow`, compute next sort_order (max+1), insert as `todo` with `created_by=userId`.
- `updateCollabTask({ taskId, patch: { title?, status? } })` — whitelist fields only; moderate title; set/clear `completed_at` on status transitions.
- `reorderCollabTasks({ collabPostId, orderedTaskIds })` — validate uniqueness, ≤200, call the RPC.
- `deleteCollabTask({ taskId })` — delete by id; rely on RLS.

### Wave 3 — Tasks tab shell

- Extend `src/components/collab/collab-workspace.tsx` tab state to `"chat" | "tasks" | "links"`; insert Tasks tab between Chat and Links with a `ListTodo` icon and optional incomplete-count.
- New `src/components/collab/collab-tasks.tsx` owning query (`["collab-tasks", collabPostId]`), inline composer (Enter to submit, 200 char cap, placeholder "Add a task…"), explicit three-option status menu, "N of M complete" header, completed strikethrough styling, empty state ("Nothing on the list yet." / "Add the first next step for this Collab."), skeleton loading and error retry.
- Share task count with the tab via a small hook (`useCollabTaskCount`) reading the same query cache to avoid double fetch.

### Wave 4 — Edit, delete, reorder

- Overflow menu per row (Edit, Move up, Move down, Delete when permitted). Inline title edit (Enter save, Esc cancel).
- Delete controls only rendered when `isOwner || task.created_by === userId`; confirmation via existing AlertDialog pattern.
- Reordering via Framer Motion `Reorder.Group`/`Reorder.Item` with a `GripVertical` handle; persist on drag end through `reorderCollabTasks`. Move up/down fallback disabled at ends.
- Optimistic updates + rollback + toast on failure.

### Wave 5 — Realtime & concurrency

- Subscribe to `postgres_changes` on `collab_tasks` filtered by `collab_post_id=eq.{id}` with a per-mount channel suffix (matches existing pattern to avoid channel reuse errors).
- Debounce invalidations during reorder mutations; suppress self-echo while a local mutation is in flight.
- Cleanup on unmount.

### Wave 6 — Mobile, a11y, QA

- 44px targets, wrap long titles, no horizontal overflow at 320px, dark mode, reduced-motion path (disable drag animations, keep Move up/down).
- `role="tab"` / tab-panel semantics preserved; status buttons announce current state; drag handles labeled; completed state not color-only (icon + strikethrough).
- Two-account convergence check for realtime + reorder.

### Out of scope (enforced)

No assignees, due dates, priorities, subtasks, comments, attachments, notifications, analytics dashboard, search, filters, Kanban, separate route, or Plus gating. No task fields in any public Collab query, SEO, OG, or public API.

### Technical notes

- Reuse `moderateOrThrow` from `@/lib/moderation/service.server` on create/edit titles (per project core rule).
- No new drag-and-drop dependency — Framer Motion is already in use.
- Realtime channel names include `crypto.randomUUID()` suffix to prevent duplicate-subscribe errors.
- Cascade delete on `collab_posts` only; closing a collab does not touch tasks.
