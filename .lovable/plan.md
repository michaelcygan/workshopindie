# Wave 3 — Single-sharer Screen Lease (client wiring)

Wave 1 already added the server side (`instant_rooms.screen_sharer_user_id`, `screen_share_claimed_at`, and the RPCs `claim_lounge_screen_share`, `refresh_lounge_screen_share`, `release_lounge_screen_share`). Wave 3 connects those to the runtime so the Lounge enforces "only one screen share at a time" durably, not just via broadcast.

No new packages, no SFU, no DB schema changes.

## Behavior contract

- Anyone in a Lounge can attempt to share their screen.
- The DB row is the source of truth for who holds the visual surface. `getDisplayMedia()` only runs after `claim_lounge_screen_share` returns success.
- Only one holder at a time. A second person trying to share sees "Someone is already sharing" and the attempt is aborted before the browser picker opens.
- Holder heartbeats every ~20s via `refresh_lounge_screen_share`. If a holder crashes / closes tab, the lease is considered stale after ~60s and another participant can claim it (the claim RPC already checks staleness).
- Holder releases explicitly on: stop button, track `ended` event, leave audio, leave room, tab close (`pagehide`).
- Other clients react to lease changes via Postgres realtime on `instant_rooms` and reconcile local `screenSharerId` state.
- Chat-only participants can also hold the lease (screen share does not require mic).

## Technical section

### 1. New helper: `src/lib/lounge-screen-lease.ts`
Thin wrappers around the 3 RPCs (`claim`, `refresh`, `release`) returning `{ ok, holder }`. Centralises error mapping (`already_held`, `not_holder`).

### 2. `src/hooks/use-media-room.tsx`
- Add `leaseHeartbeatRef` (interval id) and `leaseHolderRef`.
- `startScreenShare`: before `getDisplayMedia`, call `claimLounge…`. On failure, set an error like "Someone else is sharing" and bail (no picker). On success, proceed as today, then start a 20s heartbeat.
- `stopScreenShare`: clear heartbeat, then call `releaseLounge…` (fire-and-forget, ignore not_holder).
- On `leave()` / unmount / `pagehide` listener: if we hold the lease, release it synchronously with `navigator.sendBeacon`-style best effort (RPC via fetch keepalive fallback; acceptable if it sometimes misses — 60s staleness covers it).
- Subscribe once per room to `postgres_changes` on `instant_rooms` filtered by `id=eq.<roomId>`. On update, set `screenSharerId` from `screen_sharer_user_id`. This becomes the canonical value; the existing broadcast "screen active/inactive" signal stays as an optimistic hint but the DB wins on conflict.
- If the DB says someone else now holds the lease while we still have `screenStreamRef`, auto-stop our local share (defensive — shouldn't happen since claim is exclusive, but handles clock drift / stale-takeover).

### 3. `src/components/media-panel.tsx` / `channel-view.tsx`
- Disable the "Share screen" button (with tooltip "Someone is already sharing") when `screenSharerId && screenSharerId !== myId`.
- Keep existing "Stop sharing" affordance for the holder; no visual redesign.
- Toast on claim failure surfaces the returned holder's display name when available.

### 4. Realtime enablement
`instant_rooms` already emits `postgres_changes` in the app (used elsewhere). Confirm the publication includes it; if not, this is the only DB-touching step and would be a tiny migration to `ALTER PUBLICATION supabase_realtime ADD TABLE public.instant_rooms` (skip if already present — will verify during build).

### 5. Non-goals (still deferred)
- Push-to-talk.
- Speaker/audience roles.
- SFU / external media service.
- Camera video.

## Acceptance checks

- Two tabs in same Lounge: tab A shares → tab B's Share button becomes disabled with "Someone is already sharing"; tab B click no longer opens the OS picker.
- Tab A closes browser tab → within ~60s tab B can claim successfully.
- Tab A clicks Stop → tab B's button re-enables within one realtime tick.
- Chat-only participant can still claim the lease without joining audio.
