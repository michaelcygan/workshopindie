## Fix: make cover banner clickable for the owner

**Problem**
On the profile cover, the banner only becomes a `<Link>` to the sourced Work when `cover_work.status === "published"` AND `visibility ∈ {public, unlisted}`. If the owner's sourced Work is a draft or private, `linkable` is false and the banner is a plain `<img>` — so clicking does nothing. That's why tapping your own banner didn't navigate.

**Change (single file: `src/routes/u.$username.tsx`, cover block ~L460–493)**
- Compute `linkable` as:
  - `isOwn && profile.cover_work` (owner can always open their own sourced Work), OR
  - existing public/unlisted + published rule (for visitors).
- Show the "Open Work" pill using the same `linkable` condition.
- Keep the "Change cover" button on top (already `z-10`) so the owner's edit affordance still works; it calls `stopPropagation`/`preventDefault`, so the wrapping `<Link>` won't fire when tapping it.
- No changes to data queries, routes, or the mobile Ken Burns tiles.

**Verification**
- As owner with a draft/private sourced cover Work: tapping the banner routes to `/works/$slug`.
- As a visitor viewing someone else's profile whose cover Work is private/draft: banner remains non-clickable (unchanged).
- Public/unlisted case: unchanged.