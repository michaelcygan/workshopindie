## What to build

Three connected additions. No schema changes — reuses the existing `work_reactions` table and `toggle_work_reaction` RPC.

### 1. `@work` mentions everywhere `@` works

Extend the shared mention system so any piece on the platform can be tagged by title from any composer that already supports `@`.

- Add a new `MentionKind = "work"` to `src/lib/mention-suggestions.ts` and a `useWorkSuggestions(query, enabled)` hook.
  - Searches `works` where `status='published'` and `visibility in ('public','unlisted')`, `ilike` on `title`, cap 6.
  - Ranks the signed-in user's own works first (so "my works" are trivially reachable), then everyone else's — matches the "your collabs/groups first" pattern already in the file.
  - Insert format: `[Title](/works/<slug>) ` — same markdown-link shape as collab mentions, so existing link rendering picks it up with zero extra work.
- Extend `src/components/mention-popover.tsx` to render a new "Works" section (cover thumbnail as avatar, category as sublabel).
- Turn on the section in every existing `@` surface by adding `"work"` to the `sections` array:
  - `src/components/chat-mention-input.tsx` (Lounge + DMs)
  - `src/components/group/today-mention-popover.tsx` (Today board)
- No rendering changes needed — `[Title](/works/slug)` already renders as a link.

### 2. Heart = favorite, clickable from the Lounge Work peek

Keep it simple: the existing heart (like) becomes the "favorite" signal. No separate save button, no new icon.

- In `src/components/work-peek.tsx`, make the heart interactive: clicking it toggles a like/favorite via the existing `toggle_work_reaction` RPC (`_reaction: 'like'`), with optimistic count update and filled-heart state when active.
- Reuse the same auth-gate pattern already in `WorkActions` (prompt to sign in if not authed).
- Extract a tiny shared hook `useWorkLike(workId, initialLikes)` so `WorkActions` (full page) and `WorkPeek` (Lounge popover) share one optimistic-toggle implementation instead of duplicating it.
- Also add a subtle "Open" link to the full work page for parity with other peeks.

### 3. Private "Favorites" filter in Gallery

Let the user filter their own Gallery view to only pieces they've hearted. Private to them — everyone else's Gallery is unaffected.

- Add a third pill to the existing tab group in `src/routes/gallery.tsx`: `For you | Following | Favorites`.
  - Extend the `tab` enum in the route's `validateSearch` to include `"favorites"`.
  - Gate `Favorites` on being signed in (same treatment as `Following`).
- New fetcher `fetchFavoritesPage` that:
  1. Reads `work_reactions` for the current user where `reaction='like'`, ordered by `created_at desc`, paginated by `created_at` cursor.
  2. Fetches the matching `works` rows with the same shape as `fetchForYouPage`, preserving heart-order.
  3. Applies the same category / city / search / blocked filters already in use, for consistency.
- Empty state: "Nothing favorited yet. Tap the heart on any piece to save it here." with a link back to `For you`.
- No new table, no schema change, no RLS work — `work_reactions` already stores likes and the user reads their own under existing policies.

## Out of scope

- No notifications when someone `@`-mentions your work (follow-up).
- No public "Favorites" tab on profiles — Favorites stays private to the viewer.
- No changes to `works`, RLS, or the `toggle_work_reaction` RPC.
- No new icon or new reaction type — heart is the single favorite signal.
