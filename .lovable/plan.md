## Goal
Kill the "No one is in the Lounge" empty state on the homepage. Always show a rail of tappable Lounge cards — real live rooms first, then curated suggested prompts to fill it out. Tapping a suggested card takes the user into `/lounge` and immediately opens a real room seeded with that prompt's title + medium. Once opened, it's a normal live Lounge that appears at the top of everyone else's homepage rail.

## Scope
Frontend-only. No schema changes. Reuses existing `hostInstantWorkshop` server fn and `/lounge/` preflight (auth gate, AV device grant, camera/mic permissions) — no new backend surface, no auto-created rooms with no host, no fake occupancy.

## Files

**`src/components/home-live-workshops-rail.tsx`** (edit)
- Import `ROOM_PROMPTS` from `@/lib/topic-prompts` and a small helper that returns 4–6 well-distributed suggestions (mix of mediums, deterministically shuffled per session so the row feels fresh but stable within a visit).
- Remove the dashed "No one is in the Lounge" empty-state block entirely.
- Always render the horizontal rail. Contents = live workshops (existing card, unchanged) + suggested-prompt cards appended until the rail has ~6 tiles. If there are already 6+ live rooms, no suggestions render.
- Suggested-prompt tile is a visually distinct sibling of the live card:
  - Same `w-72` size, rounded, bordered, snap-start.
  - Top chip: "Start this Lounge" with a spark icon (not the live/coral chip).
  - Title line = prompt title.
  - Medium label + "5 seats · voice or video" meta row.
  - CTA row: "Open" → `ArrowRight`.
- Tile is a `<Link to="/lounge" search={{ prompt, medium }}>` — a real navigation, not a mutation. The `/lounge` route handles auth, AV pregrant, and room creation.

**`src/routes/lounge.index.tsx`** (edit)
- Add typed search validation: `validateSearch` accepts optional `prompt` (string) and `medium` (Category | null).
- In `WorkshopPreflight`, read `Route.useSearch()`. On mount, if `prompt` is present AND user is signed in AND `canDrop` is true AND `busy` is null, auto-invoke the existing `openLounge(medium, prompt)` once (guarded by a `ref` so it fires exactly once per visit).
- If AV isn't ready yet, wait for `devices` to resolve before firing; if the user has no mic/cam, fall back to the existing toast + let them pick manually.
- Clear the search params after firing so a browser refresh doesn't re-open a second room.

## Behavior
1. Homepage rail is never empty when there are curated prompts (always true — `ROOM_PROMPTS` has 60+).
2. Clicking a suggestion navigates to `/lounge?prompt=…&medium=…`, hits the same preflight the "Open the Lounge" button already uses, and lands the user in `/lounge/$id` as host.
3. The moment that room exists it flows through the existing `workshops` query on the homepage rail (via the invalidations `openLounge` already triggers), so every other visitor now sees a real live room at the head of the rail — the suggested tiles fall to the right or drop off.
4. Signed-out users clicking a suggestion get bounced to `/login` by the existing `RequireAuth` gate on `/lounge/`.

## Non-goals
- No auto-hosting on the homepage without going through `/lounge` (AV grant + auth must happen in the same place they do today).
- No fake "ghost" rooms in the DB.
- No changes to card content on `/lounge` itself (`RoomPromptMarquee` continues to serve that surface).

## Technical notes
- Suggestion picker: seed `shuffle(ROOM_PROMPTS)` with a per-session key from `sessionStorage` so the rail is stable during a session, and bias toward `weight: "obvious"` (take 4 obvious + 2 wild) for the home surface.
- Guard the auto-open with a `useRef(false)` flag so React StrictMode double-invoke and the `router.invalidate()` inside `openLounge` don't fire it twice.
- Keep the "All Lounges" pill and section header unchanged.
