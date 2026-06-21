## Goal

Keep people inside the Workshop while they browse Work and Collabs. Work already opens in a `WorkPeek` lightbox — extend the same pattern to Collabs so clicking a Collab from the Stage doesn't navigate away.

## What changes

### 1. New `CollabPeek` lightbox

`src/components/collab-peek.tsx` — modeled on `work-peek.tsx`:

- Controlled `Dialog` (`open`, `onOpenChange`, `collabId`).
- Fetches the collab on open via TanStack Query against `collab_posts` (id, title, slug, category, description, cover_url if present, user_id) plus `collab_roles` and the owner profile (display_name, username, avatar_url).
- Body: cover/gradient, category chip, title, owner row (clickable → existing `ProfilePeek` flow if available, else link), description, open roles list.
- Actions row:
  - **Apply** buttons per role — call existing `applyToCollab` server fn (same as on the full page). Toast on success/error.
  - **Open full Collab** → `<a href="/collab/{slug}" target="_blank" rel="noopener">` (matches WorkPeek's "Open full work").
- Skeleton state while loading, identical sizing/styling to `WorkPeek` so the two feel like one family.

### 2. Wire the peek in `workshop-collabs-panel.tsx`

- Add local state `peekCollabId` + `peekOpen`, plus `openCollab(id)`.
- Replace every `<Link to="/collab/$slug" params={{ slug }}>{c.title}</Link>` (two spots — pinned list + main list) with a `<button onClick={() => openCollab(c.id)}>` styled identically.
- The "Post one" link in the empty state stays a real `Link` (it goes to a creation flow, not a peek target).
- Render `<CollabPeek collabId={peekCollabId} open={peekOpen} onOpenChange={setPeekOpen} />` at the bottom of the panel.

### 3. Confirm Work peek coverage

Work already opens via `WorkPeek` from `channel-view.tsx` (`openWork` + `RoomGallery onOpenWork`) and from `WorkshopPresenceWorksRail`. No code change needed; just verify that the rail and any Work surface inside the Stage call `onOpenWork` rather than navigating. If a `<Link to="/works/$slug">` is found inside the Stage tabs, swap it for `openWork(id)`.

## Out of scope

- No changes to routes, server functions, or schema. `applyToCollab` and the existing collab query patterns are reused as-is.
- The full `/collab/$slug` and `/works/$slug` pages remain available via "Open full …" in each peek (new tab, so the Workshop session stays intact).

## Files touched

- **new** `src/components/collab-peek.tsx`
- **edit** `src/components/workshop-collabs-panel.tsx` (state + button swap + peek mount)
- **edit** (only if a stray Link is found) `src/components/channel-view.tsx` / `workshop-presence-works-rail.tsx`
