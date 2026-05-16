# Plan — Delightful Instant Workshop preflight + medium fork

## Goal
Keep the one-tap "Drop in → Artist's Lounge" path exactly as it is, but turn the title into a delightful dropdown that lets the user (a) join an existing medium-specific Instant Workshop, or (b) spawn a new one. Add ambient signals of life: presence counts and a scrolling activity ticker.

## UX

```text
┌──────────────────────────────────────────────────┐
│ ← Home                                           │
│                                                  │
│  Artist's Lounge ▾  ● 7 live                     │  ← click title to open dropdown
│  Drop into a live room with up to 5 artists…     │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  ((•))  Drop in                          │    │
│  └──────────────────────────────────────────┘    │
│         Mic ready    Camera ready                │
│  Rooms cap at 5 — …                              │
│                                                  │
│  ── Live now ─────────────────────────────────   │  ← scrolling ticker
│  Mira just joined Instant Workshop: Photography  │
│  Instant Workshop: Writing just ended            │
│  …                                               │
└──────────────────────────────────────────────────┘
```

**Dropdown ("fork") behavior** — animated open from the title (framer-motion, spring):
- Header row: "Artist's Lounge · always on" (the default, current behavior).
- Section "Live mediums" — one row per active medium-specific Instant Workshop with a small live dot + participant count. Click → drop directly into that room (uses the same `joinLounge` flow, but scoped to that medium).
- Section "Start a medium-specific Instant Workshop" — chip grid of all mediums. Inactive mediums show as ghost chips with a `+`; active ones show with a live count. Clicking a ghost chip spawns a new room for that medium.
- If no medium rooms exist, the live section collapses and only the "+ Start a medium-specific Instant Workshop" row + chip grid show — exactly as the user described.

The big orange "Drop in" button is unchanged and always routes to the lounge matchmaker.

**Mediums list** — use the existing `category` enum (film, music, writing, build, visual). User asked for ~10; we'll surface those 5 today and note the enum can grow later (expanding it touches many surfaces, so out of scope unless requested).

**Motion & polish**
- Title `▾` rotates 180° on open; dropdown panel scales + fades in (spring).
- Live dot next to title pulses; count animates with a number-tween.
- Chips have a subtle hover lift + scale; "+ Start" chips have a dashed border that solidifies on hover.
- Ticker auto-scrolls vertically (marquee-style, pauses on hover), new entries slide in from below.

**Presence indicator** — small `● N live` next to the title showing total people across all active Instant rooms (lounges + medium rooms).

## Technical

### Data
`instant_rooms` already has `kind ∈ {lounge, work, workshop}` and `medium category`. We'll use a new value: extend the kind check to allow `'medium'`, or reuse `'lounge'` with `medium IS NOT NULL`. **Decision:** reuse `kind='lounge'` + `medium` column — keeps matchmaker shape identical, no enum/constraint churn. `medium IS NULL` ⇒ Artist's Lounge; `medium IS NOT NULL` ⇒ medium-specific.

### Migration (single)
1. **`join_medium_lounge(_user_id uuid, _medium category) → uuid`** — mirror of `join_lounge` but scoped `WHERE medium = _medium`; spawn with `title = 'Instant Workshop: ' || initcap(_medium)` and that medium. Same 5-cap, same stale-archival logic.
2. **`list_active_instant_rooms() → table(id uuid, medium category, title text, live_count int, created_at timestamptz)`** — returns lounges + medium rooms with live presence count (`last_seen_at > now() - 60s`), archiving ghosts inline like `join_lounge` does. SECURITY DEFINER, public-readable.
3. **`instant_activity` table** — append-only feed of events for the ticker:
   - cols: `id uuid pk`, `kind text check in ('join','spawn','end')`, `medium category null`, `title text`, `actor_display_name text null`, `created_at timestamptz default now()`.
   - RLS: public read; insert via SECURITY DEFINER triggers only.
   - Trigger on `instant_presence` AFTER INSERT → emit `join` event with the room's medium/title and actor's display name (from `profiles`).
   - Trigger on `instant_rooms` AFTER INSERT (kind='lounge', medium not null) → emit `spawn`.
   - Trigger on `instant_rooms` AFTER UPDATE when `status` flips to `archived` and `medium IS NOT NULL` → emit `end`.
   - Add to `supabase_realtime` publication.
   - Retention: events older than 1 hour are pruned at the top of `list_active_instant_rooms()` (cheap and good enough; no cron needed).

### Server functions (new in `src/lib/instant.functions.ts`)
- `joinMediumLounge({ medium })` — calls `join_medium_lounge` RPC, returns `{ roomId, medium }`.
- `listActiveInstantRooms()` — public (no auth middleware), calls the RPC. Returns shape above.
- `listRecentActivity({ limit: 20 })` — public, selects from `instant_activity` ORDER BY created_at DESC.

### Client (`src/routes/instant.index.tsx` + a couple of small new components)
- `<LoungeForkDropdown />` — popover anchored to the H1, uses framer-motion + `useQuery({ refetchInterval: 5000 })` against `listActiveInstantRooms`. On medium-chip click: pre-grant mic/cam (existing logic extracted to a small helper), call `joinMediumLounge`, navigate to `/instant/$id`.
- `<ActivityTicker />` — vertical marquee of `listRecentActivity` results, realtime-subscribed to `instant_activity` INSERT. Formats: `"{name} joined Instant Workshop: {Medium}"`, `"Instant Workshop: {Medium} just started"`, `"Instant Workshop: {Medium} just ended"`. Pauses on hover, fades top/bottom.
- Refactor `handleDrop` so its mic/cam pre-grant block is reusable for both the Drop-in button and dropdown actions.
- Live count next to title comes from the same query (sum of `live_count`).

### Out of scope (call out, not built)
- Expanding the `category` enum beyond the existing 5.
- Per-medium UI inside the room (room itself stays the same — title already differs).
- Pruning `instant_activity` via cron (inline prune is enough at this scale).
- TURN servers (deferred per user).

## Files touched
- **Migration** (new): functions + table + triggers above.
- `src/lib/instant.functions.ts` — add `joinMediumLounge`, `listActiveInstantRooms`, `listRecentActivity`.
- `src/routes/instant.index.tsx` — wire dropdown, ticker, live count, motion.
- `src/components/lounge-fork-dropdown.tsx` (new).
- `src/components/instant-activity-ticker.tsx` (new).
