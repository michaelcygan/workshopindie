## Goal
On profile pages, clicking a Work should navigate to the full Work page (`/works/$slug`), not open the lightbox/peek. Keep the lightbox flow for ambient contexts (Lounges/Rooms) where users are actively in another surface and shouldn't be yanked away.

## Platform-wide rule for Works clicks
- **Profile (`/u/$username`)** → navigate to `/works/$slug` (full page). Today opens lightbox via `?w=slug`.
- **Gallery (`/gallery`), Cities, Groups index, Collab pages, Search, Fresh strip, In-Progress** → navigate to `/works/$slug` (already do, keep as-is).
- **Lounges / Rooms (`room-gallery.tsx`)** → keep the in-room lightbox/peek. Rationale: leaving the room drops you from a live session. The lightbox stays scoped to that context only.
- **Event showcase / Group pinned works** → audit: anywhere outside a live room, switch to direct navigation.

## Changes
1. `src/routes/u.$username.tsx`
   - Remove `WorkLightbox` import, the `?w=` search param wiring, `activeLightbox`/`setLightbox` prop chain.
   - Pinned-works grid and main works grid: drop `onOpen`; `WorkCard` already renders as a `<Link to="/works/$slug">` when no `onOpen` is provided (verify), so click → full page.
   - Remove the `<WorkLightbox …>` mount at the bottom of the page.
   - Clean the `w` search schema.

2. Quick sweep for any other non-room surface still using `WorkLightbox`/`onOpen={…setLightbox…}` and switch to default Link behavior. (Current usage outside profile is only `room-gallery.tsx` — keep.)

3. Leave `src/components/work-lightbox.tsx` in place (still used by rooms).

## Out of scope
- No changes to the Work page itself, room flows, or the event-photo lightbox (different surface).
