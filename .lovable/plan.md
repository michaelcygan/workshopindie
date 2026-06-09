## Audit findings

After tracing `workshop.index.tsx` → `LiveWorkshopsRail` → `LoungeForkDropdown` → `instant.functions.ts` → SQL (`list_active_instant_rooms`, `join_lounge`, `join_medium_lounge`), three real bugs stand out. Everything else (presence enrichment, cap, archival, activity feed) checks out.

### Bug 1 — Live now ignores the selected medium (the one you reported)
`LiveWorkshopsRail` lists every active room. When you pick "Film" at the top, the rail still shows the open-topic "Artist's Lounge" (medium = null). Discovery and filter disagree.

### Bug 2 — "Take an open seat" doesn't join the room you clicked
The card's CTA calls the matchmaker (`joinMediumLounge` / `joinLounge`), which picks the *fullest* room of that medium. If two Film rooms are live, clicking the one with 1/5 can land you in the one with 4/5. The displayed room and the joined room can differ.

### Bug 3 — "Any topic" matchmaker can drop you into a Film room
`join_lounge` selects `kind='lounge' AND status='active'` with no `medium IS NULL` filter. So picking "Any topic" can route you into a medium-specific lounge, which is the inverse of the user's intent (and the inverse of `join_medium_lounge`, which correctly filters by medium).

### Not bugs (verified)
- Hero "N live" counter sums all rooms — intended (it's the global pulse).
- `list_active_instant_rooms` already excludes 0-live rooms.
- Presence join + 60s cutoff is consistent across rail, dropdown, and SQL.
- Archival of ghost lounges runs in both join paths.

## Fix plan

### 1. Filter the Live now rail by selected medium
`workshop.index.tsx`: pass `selectedDropMedium` into `<LiveWorkshopsRail medium={selectedDropMedium} />`.
`live-workshops-rail.tsx`: when `medium` is set, filter `rooms` to `r.medium === medium`; when null, show all. Update the subtitle ("3 Film rooms live" vs "3 rooms live now") and the empty-state copy ("No Film rooms live — be the first").

### 2. Join the specific clicked room
Add a new server fn `joinSpecificInstantRoom({ roomId })` in `src/lib/instant.functions.ts` that:
- Verifies the room is `kind='lounge' AND status='active'`.
- Counts live presence in the last 60s; rejects if `>= 5`.
- Returns `{ roomId }` (presence row is created by the room page on mount, same as today).

`LiveWorkshopsRail.takeSeat` calls this fn instead of the matchmakers. On `Room is full` error, toast and refetch the list.

### 3. Scope `join_lounge` to open-topic rooms
Migration: edit `public.join_lounge` to add `AND r.medium IS NULL` in both the archival `UPDATE` and the `SELECT` for fullest room. New rooms it creates already have `medium = null` implicitly — make that explicit in the `INSERT` for clarity.

### Out of scope
- No UI changes to host card, hero, or workshop strip.
- No schema changes beyond the `join_lounge` function body.
- No realtime channel rewrite — the existing 5s poll is fine for this rail.

### Files touched
- `supabase/migrations/<new>.sql` — replace `public.join_lounge` body
- `src/lib/instant.functions.ts` — add `joinSpecificInstantRoom`
- `src/components/live-workshops-rail.tsx` — accept `medium` prop, filter list, call new fn
- `src/routes/workshop.index.tsx` — pass `medium={selectedDropMedium}` to the rail
