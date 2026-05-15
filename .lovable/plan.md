# Instant v3 — One product, rolling drop-in

Make Instant feel like falling into a live room. No menu, no chooser, no "full" dead-ends. The system always finds you a seat — either the live room with space, or a fresh one ready for the next person.

## Product shape

- **One product: Artist's Lounge.** Always a seat available.
- **`/instant` is the drop-in action**, not a destination. Tapping it routes you straight into a room.
- **Rolling/parallel rooms.** Cap = 5 per room. As rooms fill, new ones spawn automatically.
- **Mic OR camera required to participate.** No listen-only.
- **No "full" message ever.** The matchmaker guarantees a room.

## The matchmaker (the new core primitive)

When a user taps "Drop in" we run one server function: `joinLounge()`. It returns `{ roomId }` and the client navigates to `/instant/$roomId`.

**Algorithm (single SQL pass):**

1. Find candidate rooms: `kind='lounge' AND status='active'`, ordered by `(live_count DESC, created_at ASC)` where `live_count = count(instant_presence active in last 60s)`.
2. Pick the **fullest room with `live_count < 5`** → join it. (Bias toward consolidating energy — better to have one room of 4 than two of 2.)
3. If none qualifies (all rooms ≥5, or zero rooms), **insert a new lounge row** and return its id.
4. Mark stale rooms (`live_count == 0` for >5 min) as `status='archived'` so we don't accumulate ghosts. (Cron-light: do it inline at end of each `joinLounge` call.)

This makes the "6th user spawns room 2, 7th joins room 2, 8th joins room 1" behavior automatic — no UI for picking rooms, ever.

**Why bias to fullest-with-room (not least-full):** the failure mode of social rooms is fragmentation into ghost towns. Always packing the live room first means each lounge feels alive until it splits.

## Drop-in flow

```text
Home → tap "Instant"
      ↓
   [pre-flight card: Voice / Video]   ← only choice the user makes
      ↓ (mic/cam grant)
   joinLounge() → /instant/$roomId
      ↓
   Lounge room (5 cap, video + chat stage + Around list)
```

- **Pre-flight on `/instant`:** a single screen with the Voice / Video buttons (matches the screenshot you liked). No room selection. Tapping either grants media, calls `joinLounge`, then navigates.
- **Skip:** `← Instant` back link goes home (`/`). No "next room" cycling — we're not Chatroulette, the whole point is the matchmaker already optimized.
- **Re-drop:** if you leave and tap Instant again, you may land in a different room (whichever is the fullest-with-room *now*). That's a feature — keeps energy mixing.

## Layout (video + chat in the main stage)

Same shell as today, with video tiles inside the main panel above the chat. Hidden when nobody is on cam — quiet rooms render exactly like your screenshot.

```text
┌───────────────────────────────┬─────────────────────┐
│  STAGE                        │  LIVE · LOUNGE 03   │
│  ┌─────┬─────┬─────┐          │  N/5                │
│  │ vid │ vid │ vid │  ← grid  │  [Mute] [Cam] [Leave]│
│  └─────┴─────┴─────┘          ├─────────────────────┤
│                               │  AROUND · N         │
│  chat scroll …                │  • greenhousecrtv   │
│  [ Say something… ]      ▶    │  • …                │
└───────────────────────────────┴─────────────────────┘
```

- Room title shows as "Lounge 03" (sequential index per active room) so users have a fuzzy sense of which one they're in without having to choose.
- Right column: live count + media controls (Mute / Cam toggle / Leave) + Around list with `/u/$username` links.

## Routes

| Route | Purpose |
|---|---|
| `/instant` | Pre-flight: Voice/Video grant + `joinLounge()` redirect |
| `/instant/$roomId` | A specific live lounge (the one the matchmaker put you in) |
| `/instant/lounge` | **delete** (collapsed into matchmaker) |
| `/instant/work*` | **delete** (Work concept retired for launch) |
| `/instant/new` | **delete** |
| `/` LiveNowStrip | "N live across X lounges" — single pill linking to `/instant` |

## Caps & media rules

- `ROOM_CAP`: **5** (per room). `VIDEO_CAP`: **5** (any of 5 can cam).
- Strip `"listening"` mode entirely from `MediaMode`, `useMediaRoom`, `MediaPanel`. Default join = `"voice"`.
- 6th simultaneous arrival never sees a "full" message — the matchmaker routed them to a different room before they got here.

## DB

Schema is fine — `instant_rooms` already supports multiple lounges (it's just a row per room). One migration:

1. **Add** `instant_status` value `'archived'` if not present (or use existing status enum).
2. **Index**: `CREATE INDEX ON instant_rooms (kind, status, created_at);` and `CREATE INDEX ON instant_presence (room_id, last_seen_at);` for the matchmaker query.
3. **Cleanup**: archive any existing `kind='work'` rows (data only, schema stays).
4. **RLS**: allow authenticated users to `INSERT` into `instant_rooms` when `kind='lounge'` (currently restricted to work rooms with `creator_id = auth.uid()`). The matchmaker server function will set `creator_id = auth.uid()` when spawning.

## Server function: `joinLounge`

`src/lib/instant.functions.ts`:

```ts
createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // 1. Archive ghost rooms inline (1 query)
    // 2. Pick fullest active lounge with live_count < 5 (1 query, joins instant_presence with last_seen_at > now() - 60s)
    // 3. If none, insert new lounge row
    // 4. Return { roomId, slot: liveCount + 1 }
  })
```

Single round-trip, idempotent enough that two simultaneous taps just produce two presences in adjacent slots.

## Files to touch

**Edit**
- `src/hooks/use-media-room.tsx` — caps to 5/5, drop `"listening"`, default `"voice"`.
- `src/components/media-panel.tsx` — strip listening UI, move video grid out (to stage), keep join card + speaker list + controls.
- `src/components/channel-view.tsx` — restructure left panel into `<VideoStage media={...} />` + chat. Lift `useMediaRoom` here, pass down (one RTC instance per page).
- `src/routes/instant.index.tsx` — replace chooser with pre-flight (Voice/Video → `joinLounge` → navigate).
- `src/routes/instant.$id.tsx` — **stop redirecting**, render the room (the matchmaker target).
- `src/routes/index.tsx` `LiveNowStrip` — show aggregate "N live across X lounges".

**Create**
- `src/lib/instant.functions.ts` — `joinLounge` server function.

**Delete**
- `src/routes/instant.lounge.tsx`
- `src/routes/instant.work.tsx`, `instant.work.index.tsx`, `instant.work.$id.tsx`, `instant.work.new.tsx`
- `src/routes/instant.new.tsx`

**Keep**
- `src/routes/instant.tsx` (layout outlet).

## Technical notes

- **Single `useMediaRoom` per room view** — lifted to `ChannelView` so video stage and side panel share one mesh.
- **Room numbering** — derive client-side: query active lounges ordered by `created_at ASC`, find current room's index +1. Display "Lounge 03". Cosmetic only.
- **Race conditions** — two users tapping Drop-in in the same 100ms might both spawn rooms when one would have sufficed. Acceptable: matchmaker will consolidate the next arrival into the fuller of the two.
- **Lurker-safe count** — keep the lurker presence channel in `useMediaRoom` so the `N/5` chip on the side panel stays accurate without a join.
- **No new dependencies.**

## Out of scope (next pass)

- Topic tags per room ("Right now: synths / poetry / VFX")
- "Find me a different room" button (manual rematch)
- SFU upgrade — mesh is fine at 5
- Push notifications when rooms are live
