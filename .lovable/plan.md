## Changes

**1. Merge "Live" + "Around" into one panel** (`channel-view.tsx`, `media-panel.tsx`)
Single right-rail card titled `INSTANT WORKSHOP · n/5`:
- Header with live dot + count chip
- Mute / Camera / Exit buttons (same row layout as today)
- Below the buttons: unified participant list — you first (with `(you)` + speaking ring + mute icon), then peers (with speaking ring, profile link). Each row shows avatar + name + mic state. No separate "Around" card.
- Remove the standalone `<aside>` "Around" block and the `Users` import.

**2. Rename "Lounge 01" → "Instant Workshop"** (`instant.$id.tsx`)
- Drop the `allRows` query and the `Lounge NN` index logic. Title is always `Instant Workshop`.
- Page subtitle stays "Live room · up to 5 artists."
- `ChannelView` `title` prop = `"Instant Workshop"`. Empty-state copy becomes "Quiet in here." Chat placeholder "Say something…".
- Update `<head>` title to "Instant Workshop".

**3. Layout polish**
- Right rail keeps `md:grid-cols-[1fr_260px]`. Single card is shorter — fine.

## Scale audit (100k concurrent)

Honest answer: **no, the current architecture won't hold 100k concurrent**. It's fine for early launch (hundreds, low thousands) but several pieces hard-cap before 100k:

**Hard limits today**
- **Mesh WebRTC** (`use-media-room.tsx`) — every participant peers with every other in the room. Cap is 5, so the room itself is fine, but each client also uploads its stream N-1 times. At 100k users that's ~20k rooms × 5 uplinks — bandwidth is on the *clients*, so this part actually scales. ✅
- **Supabase Realtime channels** — one channel per room (`media:${id}`, `media-lurker:${id}`, `instant:${id}`) = **3 channels per room × 20k rooms = 60k channels**. Supabase Realtime's published soft cap is ~10k concurrent channels per project on standard tiers. ❌ Needs sharding or a dedicated realtime tier.
- **`join_lounge` RPC contention** — single SQL function does `UPDATE ... archived` + `SELECT ... ORDER BY live_count DESC` on every join. Under burst load (say 5k joins/sec) the archive UPDATE will lock-contend and the LATERAL count subquery is O(rooms × presence). Needs: (a) move stale-archive to a cron job, not inline; (b) maintain `live_count` as a column updated by presence triggers, indexed. ❌
- **Presence heartbeat every 30s** writes to `instant_presence` from every client → 100k writes / 30s = ~3.3k writes/sec sustained, plus realtime fan-out. Postgres can handle the writes, but the realtime DELETE/INSERT broadcasts amplify badly. Better: use Supabase Realtime *presence* (in-memory, ephemeral) instead of a DB table for live count; keep DB only for the room registry.
- **Lurker channel on home page** — every visitor to `/` subscribes to a global presence channel. At 100k that's 100k subscribers on one channel — Realtime will choke. Need to swap for a polled count endpoint with short cache (e.g., 5s edge cache).
- **Chat fan-out via `postgres_changes`** is the slowest realtime path (DB → WAL → Realtime). At scale switch to `broadcast` channel events for chat, persist async.

**Optimizations that fit the current launch (do now)**
- Replace home-page lurker channel with a cached `/api/public/instant-stats` endpoint (5s cache).
- Move `instant_presence` to Realtime presence (in-memory) — drop the table heartbeat entirely. Keep DB only for messages + rooms.
- Add `live_count int` column on `instant_rooms`, maintained via presence join/leave events; index `(kind, status, live_count)`. Simplifies `join_lounge` to a one-shot `SELECT ... WHERE live_count < 5 ORDER BY live_count DESC LIMIT 1`.
- Move ghost-room archival to a cron route (`/api/public/cron/archive-lounges`) running every minute.
- Switch chat to `broadcast` events; insert to DB async for history.

**Required for true 100k (defer until needed)**
- SFU (LiveKit / Daily / mediasoup) instead of mesh — needed if you ever raise the cap or add screenshare.
- Sharded Realtime / dedicated realtime infra.

**Recommendation:** ship the 3 UI changes now. Do the home-stats cache + presence-in-memory + `live_count` column as a follow-up before any real launch push — that gets you to comfortably ~10k concurrent without touching WebRTC or adding an SFU. The 100k figure needs a separate infra workstream.

## Out of scope for this plan
- WebRTC SFU migration
- Realtime sharding
- The scale optimizations above (separate plan if you want them)

## Files touched
- `src/components/channel-view.tsx` — remove Around card, drop `Users` import, pass merged list to MediaPanel
- `src/components/media-panel.tsx` — render full participant list under buttons
- `src/routes/instant.$id.tsx` — static "Instant Workshop" title, drop indexing query
