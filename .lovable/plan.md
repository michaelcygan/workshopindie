# Workshop page v1 — finish the loop

Two fixes, framed as "make discovery obvious + make hosting honest."

## 1. Be honest when there's no live one

Today: clicking **Film** (or any medium chip) silently calls `join_medium_lounge`, which spawns a brand-new room if none exist and makes the clicker the host. No warning, no signal.

### Fix
Use the live counts we already fetch in `LoungeForkDropdown` (`mediumLiveMap`) and pipe them up to drive both label and behavior.

- **Inside the dropdown** (`src/components/lounge-fork-dropdown.tsx`):
  - For each medium chip, render one of three states:
    - **Live N** (live > 0, today's primary chip) — same look as now, `· N` count.
    - **Empty — start one** (live === 0) — dashed, with a tiny `+` and the copy "Start the room".
  - Hover/tap title attr: "You'll be the first one in — your seat opens it."
- **In `WorkshopStrip`**: when `rooms.length === 0`, show a single nudge card "No live rooms right now. Drop in to start the first one — others will see you live."
- **In `workshop.index.tsx`**:
  - Pipe `mediumLiveMap` (or just `liveCount` for the selected medium) out of `LoungeForkDropdown` via a new `onMediumLiveMapChange` callback, OR re-use the existing query in the parent.
  - Change the primary CTA copy dynamically:
    - selected medium with live > 0 → "Drop into Film (3 live)"
    - selected medium with live === 0 → "Open the first Film room"  ← clearer than "Drop into Film"
    - no medium, liveCount > 0 → "Drop in (N live)"
    - no medium, liveCount === 0 → "Open the first one"
  - Same for the Host card — no copy change needed there since that one is already explicit.
- Keep the existing matchmaker behavior server-side (one RPC, same flow) — only the framing changes.

## 2. Make live discovery obvious — the viral loop

Today the only live signal is buried in a closed dropdown and a small activity ticker. Move it above the fold.

### Add a "Live now" rail directly under the hero
New component `src/components/live-workshops-rail.tsx` that renders one card per active room with an open seat (uses `listActiveInstantRooms`, refetch 5s — already implemented).

Each card:
- Medium chip (Film / Music / …) or "Open topic"
- Title (e.g., `Film Workshop`, `Artist's Lounge`)
- Live ring + `N/5` seat indicator
- Avatar stack of current participants (up to 3 + `+N`)
- Primary button: **Take an open seat** (calls `joinMediumLounge` for that medium, or `joinLounge` if no medium) — routes straight into `/workshop/$id`
- Disabled state when `live_count >= 5` with copy "Full — try another"
- Auto-scrolls horizontally on overflow

Empty state: a single dashed card "No live rooms right now. Be the first." that triggers `handleDrop` with the current selected medium.

### Where it goes
Right under the Drop in / Host two-up grid, above `WorkshopStrip` (scheduled workshops). Order becomes:
1. Hero + Drop in / Host (existing)
2. **Live now rail** ← new
3. Scheduled workshops strip (existing)

### Surface presence on cards
Avatar stack needs participant profiles. Add an RPC `list_active_instant_rooms_with_presence` (or a lightweight client-side join via `instant_presence` + `profiles`) returning `participants: { user_id, display_name, avatar_url }[]` per room. Cap at 3 for the avatar stack; backend caps the list at 5 max anyway.

### Viral loop
- Each live room card carries a **Share** icon → copies `/workshop/$id` to clipboard with a toast. (Anyone with the link who is signed in can drop in — current RLS already permits this.)
- Mobile-nav notifications stay as-is; not extending scope here.

## Out of scope
- No new tables; reuse `instant_rooms`, `instant_presence`, `profiles`.
- No changes to matchmaker SQL — UI does the framing.
- No invite-by-name / discovery feed beyond what's surfaced here.
- No recording or replay of past live rooms.
- No notifications when a watched medium goes live (queue for next sweep).

## Files
- `src/routes/workshop.index.tsx` — dynamic CTA copy; insert `<LiveWorkshopsRail />`.
- `src/components/lounge-fork-dropdown.tsx` — "Start the room" empty state on chips; expose live map.
- `src/components/workshop-strip.tsx` — empty-state nudge.
- `src/components/live-workshops-rail.tsx` — new.
- `src/lib/instant.functions.ts` — extend `listActiveInstantRooms` to include presence (top 3 participants).
- One SQL migration if we extend the RPC's return shape; otherwise client-side enrich via a follow-up `instant_presence` query.
