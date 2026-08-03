## Wave 0 findings (verified against current code and the live database)

Branch tip is `4143d275` (ahead of the audited `47fed35`).

**Confirmed problems**

1. `public.join_group_lounge(_user_id, _group_id, _exclude_room_ids)` hardcodes `_cap int := 5` and passes it as `participant_cap` on room creation. By contrast `public.join_lounge` already uses `COALESCE(r.participant_cap, 20)`. There are currently **0 active group-scoped lounge rooms**, so the "update existing cap-5 rooms" step is a safety net, not a data fix.
2. `instant_presence` columns are `audio_state` (default `'listener'`), `audio_requested_at`, `audio_offer_expires_at`, `audio_joined_at`. `src/hooks/use-stream-lounge-audio.ts` declares `type AudioState = "chat" | "queued" | "offered" | "speaker"` and selects a nonexistent `queued_at` column — so queue position, sorting, and role rendering are wrong today.
3. `TodayPresenceBubbles` subscribes to `gtp-presence-${groupId}-${Math.random()...}`, so no two viewers share a topic.
4. `moderate_lounge_speaker` authorizes only `instant_rooms.host_user_id` or a platform admin; group rooms are created with `host_user_id = NULL`, so nobody can moderate group audio.
5. Navigation surfaces to change: `top-nav.tsx` (Lounge link), `mobile-island/mobile-tabs-config.ts` (`lounge` tab), `group-tab-bar.tsx` ("Open the Lounge" create item), `home/now-module.tsx` (separate Lounge row → `/lounge/$id`), `home/public-home.tsx`, `group/group-lounge-card.tsx`.

**Reference classification**: ~95 files mention Lounge. Group-scoped audio: group components, `instant.functions.ts`, stream provider/hooks. Standalone legacy: `lounge.index.tsx`, `lounge.$id.tsx`, `channel-view.tsx`, `room-gallery.tsx`, `lounge-posts.tsx`, `workshop-collabs-panel.tsx`. Infrastructure/telemetry/entitlements/admin analytics stay untouched except copy.

## Wave 1 — Stabilize the realtime core (UI unchanged)

Forward-only migration (single call):
- `CREATE OR REPLACE FUNCTION public.join_group_lounge(...)` — same signature; `COALESCE(r.participant_cap, 20)` cap, fill the fullest non-full room first, create overflow only when all are full, keep removal/block checks and stale cleanup, create new rooms with `participant_cap = 20`.
- `UPDATE public.instant_rooms SET participant_cap = 20 WHERE kind='lounge' AND group_id IS NOT NULL AND status='active' AND participant_cap = 5`.
- `CREATE OR REPLACE FUNCTION public.moderate_lounge_speaker(...)` — allow host, platform admin, **or** group owner/steward via `group_members` on the room's `group_id`; unchanged behavior otherwise.

Code:
- `src/hooks/use-stream-lounge-audio.ts` — vocabulary to `listener | waiting | offered | speaker`, select `audio_requested_at`, fix sorting/queue-position/role mapping; keep `offered` handling.
- `src/lib/lounge-audio-types.ts` — single shared state union.
- New `src/lib/group-audio.functions.ts` (thin wrapper, helpers in `group-audio.server.ts`) — `joinGroupAudio`: authenticate → verify membership + group visibility → `join_group_lounge` → claim `instant_presence` seat → return `{ roomId }`. Stream token minting stays a separate call gated on an existing presence row (`src/lib/stream-video.functions.ts` guard added).
- New `src/hooks/use-group-presence.ts` — one topic `group-presence:${groupId}`, presence key = user id, dedupe by user id, clean teardown.
- `src/components/stream-lounge-provider.tsx` — mount lazily; no token on mere visit; join as listener with mic off; explicit mic request.
- Remove any quota-based disconnect path from audio (telemetry recording stays).

Gate: build/lint clean, `/lounge` and `/lounge/$id` still work, direct server-fn call on a private group rejected.

## Wave 2 — Group live experience

- `src/components/group/group-live-shell.tsx`, `group-audio-dock.tsx`, `src/hooks/use-group-audio-session.ts`, `src/components/shared-links-list.tsx` (presentational extraction from `lounge-links.tsx`).
- Mount `GroupLiveShell` above the tab switch in `src/routes/g.$slug.index.tsx` so audio survives tab changes. `ChannelView` is never mounted in Groups.
- `group-hero.tsx` / `group-tab-bar.tsx`: replace "Open the Lounge" with `Join audio` / `Join audio · X live`, live dot, state labels, `Leave audio`. Mobile: safe-area bottom pill expanding to a sheet.
- `group-today-tab.tsx`: keep `group_today_posts` as the only conversation; swap in `useGroupPresence` for the Here-now row; drop the `GroupLoungeCard` reference from the module rail (file kept).
- New `Links` tab (`work` search value unchanged; Gallery relabeled `Work`) deriving URLs from unexpired Today posts through the existing blocklist.

Gate: two sessions see each other, join audio prompts no mic, mic request works, audio survives tab changes, links respect moderation.

## Wave 3 — Navigation, discovery, Home, compatibility

- `top-nav.tsx`: drop Lounge; lead with Groups + Collabs.
- `mobile-tabs-config.ts` + `use-active-tab.ts`: Home / Collabs / Create / Groups / You; `/g/*` and `/groups` activate Groups.
- `groups.index.tsx`: compact `Live now` filter from active group `instant_rooms` + recent `instant_presence`; cards link to the Group.
- `home/now-module.tsx` + `lib/home.server.ts` / `home-types.ts`: merge Today + Lounge into one Group pulse row ("6 here now · Audio live") linking to the Group Today tab; Events unchanged; internal type names may keep Lounge naming.
- `home/public-home.tsx`: replace the "Drop into the Lounge" CTA with Group-centered copy.
- `routes/lounge.index.tsx` → redirect to `/groups?live=true`. `routes/lounge.$id.tsx` → if the room has `group_id`, redirect to `/g/$slug?audio=$roomId` (validated search on the group route, deliberate deep link enters as listener after membership check); group-less rooms keep the legacy page.
- Group-scoped invitations/notifications/rejoin links and `/w/$token` point at the Group; standalone invites unchanged. Route tree regenerates itself.

## Wave 4 — Hardening and conservative cleanup

Remove only proven-dead imports and copy. Keep `instant_rooms`, `instant_presence`, `instant_messages`, Stream functions, speaker-queue RPCs, `lounge_audio_events`, sweep jobs, removal/blocking, legacy routes, analytics history. Audit `entitlement-copy.ts` / `plus-gate.tsx` so basic Group audio is never framed as paid.

## Risks and assumptions to validate

- Stream token gating: I need to confirm exactly where `stream-video.functions.ts` mints tokens before adding the admission precondition; if it can't be gated safely I'll report rather than guess.
- Speaker cap of 10 is enforced by the existing queue RPCs; I'll verify before Wave 1 rather than adding a second cap.
- Group audio moderation assumes `group_members.role` values `owner`/`steward` — verified in the schema enum `group_member_role`.
- Redirect from `/lounge/$id` requires reading the room pre-auth; I'll route it through a public server function returning only `{ groupSlug }`.
