# Audit: In-Workshop Collaboration Suite

I went through `profile-peek.tsx`, `work-peek.tsx`, `room-gallery.tsx`, `room-whiteboard.tsx`, `channel-view.tsx`, `media-panel.tsx`, `room-views.functions.ts`, and the two whiteboard migrations. Below is what's solid, what's incomplete, what won't scale, and what to add for a 2026-grade feel.

---

## What's solid

- RLS is correctly scoped: whiteboard asset rows + storage uploads both require being present in the room. Admin override exists. Bucket is mime/size-capped (5MB, image-only).
- Lazy-loading `tldraw` via `React.lazy` keeps the main bundle clean.
- Profile peek uses HoverCard on desktop / Drawer on mobile — right primitive choice.
- Gallery batches works in a single `IN (...)` query.
- `purgeRoomWhiteboard` is server-fn with admin client + zod-validated input.

---

## Gaps & bugs to fix

### Profile peek
1. `HoverCardTrigger` has both `asChild` and an extra `onClick={() => setOpen(true)}` — this fights the hover behavior on desktop and causes flicker. Drop the manual onClick; let HoverCard own it (keep the Drawer onClick separately for mobile).
2. Module-level `cache: Map` grows unbounded for a long session and is invisible to the rest of the app. Replace with TanStack Query (`['peek', userId]`, 60s `staleTime`), so it shares with the gallery query and follow mutations can invalidate it.
3. Loading state is bare text — add a 3-line skeleton matching final layout so the card doesn't jump.
4. Stat counters render raw (`12834 followers`). Add a `formatCompact` (`12.8k`).
5. The "speaking ring" promised in the plan is wired in the avatar but not in the trigger — pass `speaking` through `SpeakerRow` so the ring pulses on the avatar in the participants list too.

### Work peek
1. Two sequential round-trips (work, then profile). Collapse into one query with the embedded relation: `select('..., creator:profiles!works_created_by_fkey(id,display_name,username,avatar_url)')`.
2. No view-count bump on open — fire-and-forget `rpc('increment_work_view', { _id })` so peeks count.
3. No like/save/share inline — add the same `WorkActions` row used on `/works/$slug` so engagement doesn't require leaving the room.
4. No skeleton, no error state.

### Room gallery
1. Single `.limit(120)` across all members starves prolific creators. Either paginate per-tab (cursor on `published_at`) or compute a per-user cap (e.g. `min(20, ceil(120/members))`).
2. No realtime: if someone publishes a work mid-workshop, the gallery doesn't refresh. Subscribe to `INSERT/UPDATE` on `works` filtered by `created_by in (...)`.
3. `Object.keys(worksByUser)` iteration order is insertion order — fine today, but the "Everyone" sort should also stable-tiebreak on `id` to avoid layout shuffles when timestamps tie.
4. Add a category filter chip row (reuse `CategoryChip`) — instantly more browseable.
5. Empty-state CTA: when it's me and I have nothing, button → `/works/new`.
6. Gallery is hidden behind a toggle but the plan called for **side-by-side split with emphasis on gallery**. Right now toggling to Gallery removes chat entirely. Add a desktop split layout (`lg:grid-cols-[1fr_320px]`) where chat collapses to the right rail; on mobile keep the toggle.

### Whiteboard (this one has the biggest scaling/correctness issues)
1. **Snapshot broadcast won't scale.** Today every change broadcasts the full `getSnapshot(editor.store)`. A canvas with a few images easily exceeds Supabase Realtime's 256KB payload cap and burns bandwidth at every stroke. Switch to incremental sync:
   - Use `editor.store.listen` with `scope: 'document', source: 'user'` and broadcast the **diff** (`changes` from the listener callback) instead of the full snapshot.
   - Apply remote diffs with `editor.store.mergeRemoteChanges(() => editor.store.applyDiff(diff))` so the local listener doesn't echo.
   - Keep `request-state` for late joiners, but cap snapshot size and chunk if needed.
   - For 100k MAU scale, plan an opt-in upgrade path to `@tldraw/sync` (a tldraw-supported sync server) — out of scope now, document it.
2. `loadSnapshot` resets the entire store and **clobbers the recipient's in-flight edits** (last-write-wins on the whole document). The diff approach above fixes this.
3. The asset uploader awaits storage but does **not** await the DB insert tracking row. If the insert fails, the file becomes an orphan invisible to `purgeRoomWhiteboard`. Await it, and on failure delete the object before throwing.
4. `purgeRoomWhiteboard` only runs if the leaving user observes `count <= 1`. Two simultaneous exits = no purge. Add a server-side safety net:
   - DB trigger on `instant_presence` AFTER DELETE: if no presence rows remain for that `room_id` AND room kind = `lounge`, mark room `archived` and enqueue a purge (either inline via plpgsql or via `pg_net` to the server fn).
   - Add a nightly `pg_cron` job that purges orphaned assets older than 24h (belt + suspenders, also catches BrowserCloses that skipped `handleExit`).
5. Bucket is `public: true` — image URLs are guessable & permanent until purge. Acceptable for ephemeral, but document it; if we want stronger privacy, switch to a private bucket + signed URLs (4h TTL).
6. No collaborative cursors. Add `tldraw`'s `useCollaboration` via Realtime presence track — names + colored cursors are the single biggest "wow" upgrade.
7. No "clear board" affordance for the host.

### Channel view
1. `profileLookup` and `peerById` Maps are rebuilt every render — wrap in `useMemo`.
2. `instant_presence.upsert(...)` has no `onConflict` clause — relies on PK behavior; verify there's a unique `(room_id, user_id)` constraint, otherwise heartbeats race-insert dupes. If missing, add it.
3. New-presence handler fires a per-row profile fetch (N+1). Move profiles into the initial join query via the embedded relation already used (`profile:profiles!instant_presence_user_id_fkey`) and trust the payload + a single batched refetch on N inserts (debounce 300ms).
4. Per-room `postgres_changes` subscriptions scale poorly past a few thousand concurrent rooms. For 100k:
   - Migrate `instant_messages` to Realtime **broadcast** (server fn inserts and broadcasts in one go); keep `postgres_changes` only for `instant_presence` or replace with Realtime `track()` presence entirely (eliminates the 30s heartbeat UPDATE storm).
5. Messages claim "vanish after 24h" in the empty state but no cleanup job exists. Add a `pg_cron` daily delete.
6. `handleExit` purges the board but doesn't `await` — works fine, but log failures so we can see orphans in production.

### Follow flow in-room
1. `FollowButton` exists in peek — good. But the plan promised an **ephemeral "X followed you" toast** broadcast to both users. Add a broadcast on the existing `instant:${roomId}` channel; toast decays 4s.
2. On follow success, invalidate the peek query for both users so counters update live.
3. Add a tiny "Followed in this workshop" badge in the participants list — social proof + reminds the user later.

---

## 2026-grade UI polish

- **Glass + grain.** Peek/Dialog surfaces: `bg-surface/85 backdrop-blur-xl` with a subtle noise overlay (single inline SVG bg). Modern, depth, no extra deps.
- **Reduced motion.** Wrap framer transitions in `useReducedMotion()` so the stagger/fade respects OS pref.
- **Speaking ring on participants list**, not just the peek.
- **Now-viewing presence in gallery.** Tiny avatar stack on each card showing who's currently looking at it (broadcast `viewing:{workId}` over the room channel; decays on close).
- **"Just looked at" rail** at gallery footer — last 6 works opened by anyone. Bridges silent browsing into conversation.
- **Reaction layer.** Double-tap any work in gallery → floating emoji that everyone sees (broadcast). Confetti burst on follow.
- **Whiteboard polish:** collaborative cursors w/ names, "download PNG" already exists — also add "copy to clipboard" and a snap-to-grid toggle. Host can clear board.
- **Keyboard shortcuts** in fullscreen: `G` gallery, `B` board, `C` chat, `M` mute, `V` camera, `?` shows the cheatsheet.
- **Empty-state nudges** — "Show me yours" button in a member's empty gallery tab pings them in chat with a deep link to upload.
- **Tactile microinteractions** — Button press scale `0.97`, follow morphs from `Follow` → `✓ Following` with a checkmark draw-in.

---

## Scale-to-100k summary (priorities)

1. **Whiteboard: switch from full-snapshot to diff broadcasts** (correctness + bandwidth + payload cap).
2. **Presence via Realtime `track()` instead of DB heartbeats** (kills a 30s write-per-user load).
3. **Messages via broadcast, not `postgres_changes`** (Realtime's `postgres_changes` is the first thing to bottleneck at scale).
4. **Server-side empty-room cleanup** (DB trigger + nightly cron) — don't rely on the client to purge.
5. **TanStack Query everywhere** for peek/gallery — shared cache, automatic invalidation on follow/publish, suspense-friendly.

---

## Implementation phases

**Phase A — correctness & scale (highest impact)**
- Whiteboard diff sync + tracked-asset await + cleanup trigger + nightly cron
- Presence via Realtime `track()` (drop heartbeat UPDATEs)
- TanStack Query migration for peek + gallery
- HoverCard onClick fix; profileLookup `useMemo`; ensure `(room_id,user_id)` unique on presence
- Realtime subscription for `works` inserts in gallery
- Work peek single-query + view-count bump + inline like/save

**Phase B — collaboration features**
- Gallery side-by-side layout w/ collapsible chat rail
- Follow-broadcast toast + "followed in this workshop" badge
- Whiteboard collaborative cursors + host "clear board"
- Category filter chips + per-user pagination in gallery
- 24h message cleanup cron

**Phase C — polish**
- Speaking ring everywhere, reduced-motion guards, glass+grain surfaces
- Now-viewing avatar stacks, "Just looked at" rail, reaction emojis, follow confetti
- Keyboard shortcut layer in fullscreen + `?` cheatsheet

---

## Technical notes (skip if non-technical)

- tldraw diff API: `editor.store.listen((entry) => entry.changes /* added/updated/removed */)` with `mergeRemoteChanges` on the receiver. Confirm against installed tldraw version before wiring.
- Realtime broadcast for messages requires a small `sendMessage` server fn that does `insert` + `channel.send` atomically; the client subscribes to broadcast only.
- Empty-room trigger: `CREATE TRIGGER ... AFTER DELETE ON instant_presence ... WHEN (NOT EXISTS (SELECT 1 FROM instant_presence WHERE room_id = OLD.room_id))` → call a SECURITY DEFINER function that updates room status and `pg_net.http_post` to `/api/public/hooks/purge-room` (apikey header).
- Out of scope: persisting boards across sessions, full sync server (`@tldraw/sync`), comment threads on works inside the peek, push notifications.

Approve and I'll start with Phase A.
