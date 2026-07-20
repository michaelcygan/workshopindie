## Problem

1. **CollabPeek dialog renders empty (skeleton forever)** on the event page. Its Supabase query in `src/components/collab-peek.tsx` selects `cover_url` from `collab_posts`, but that column doesn't exist on the table. The query throws, `data` stays undefined, and the skeleton state never resolves — matching the screenshot.
2. **Hover-to-preview doesn't work on collab or work tiles.** In `src/components/event-attendee-work.tsx`, the compact tiles only have `onClick` → open a Dialog. There is no `HoverCard` (the pattern ProfilePeek uses on desktop), so hovering does nothing.

## Fix

### 1. CollabPeek: drop the missing column
In `src/components/collab-peek.tsx`:
- Remove `cover_url` from the `collab_posts` select list.
- Remove the `cover_url` field from the local `CollabRow` type.
- Always render the `gradient-soft` fallback header (no cover branch). Collabs have no covers anywhere else in the app either.

### 2. Add hover-to-preview to collab/work tiles
In `src/components/event-attendee-work.tsx`, wrap each tile's trigger button with a shadcn `HoverCard` on desktop only (mirroring the `ProfilePeek` desktop/mobile split via `useIsMobile`). On mobile, keep the current click-to-open-Dialog behavior — hover isn't a mobile gesture.

- Import `HoverCard`, `HoverCardTrigger`, `HoverCardContent`, and `useIsMobile`.
- Introduce two small hover preview bodies:
  - `CollabHoverPreview({ collabId })` — fetches the same data as `CollabPeek` (via a shared `collabPeekQueryOptions(collabId)` helper exported from `collab-peek.tsx`) and renders a compact 320px-wide card: cover fallback, title, category chip, first 3 open roles, "Click to open" hint.
  - `WorkHoverPreview({ workId })` — uses `getWorkPeekDetail` server fn, renders cover (16:9), title, category, excerpt (line-clamp-3), like/view counts.
- Wrap each `CompactCollabTile`/`CompactWorkTile` button:
  - Desktop: `HoverCard openDelay={200} closeDelay={100}` → `HoverCardTrigger asChild` around the existing button; content is the hover preview. Click still fires `onOpen` → full Dialog.
  - Mobile: render the button unchanged.
- Prefetch on hover-enter is unnecessary because `HoverCardContent` only mounts after the delay; the query fires then and is cached for the subsequent click into the Dialog (same key).

### 3. Share query options
Export `collabPeekQueryOptions` and `workPeekQueryOptions` from the peek files so both the hover preview and the full Dialog hit the same TanStack Query cache key — hovering warms the Dialog.

## Scope guardrails
- No schema changes, no server function changes.
- No changes to work-peek/collab-peek Dialog UI other than the removed `cover_url` column.
- Behavior on mobile is unchanged.

## Files touched
- `src/components/collab-peek.tsx` — drop `cover_url`; export `collabPeekQueryOptions`.
- `src/components/work-peek.tsx` — export `workPeekQueryOptions`.
- `src/components/event-attendee-work.tsx` — add desktop HoverCard wrappers around collab/work tiles with lightweight preview bodies.
