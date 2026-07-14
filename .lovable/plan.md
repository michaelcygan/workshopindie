# Lounge fullscreen: side-panel toggle + Screening Mode with lounge-wide pinned Works

Two additions to the fullscreen Lounge experience (`FullscreenRoom` in `src/components/media-panel.tsx`), both driven from what's already published on the site.

## 1. Side-panel toggle: Chat / Collabs / Gallery

Fullscreen currently shows only Chat on the right (`ChatPanel`, ~360px). Add a small segmented control at the top of that side panel — same look as the existing `ViewPill` cluster used in non-fullscreen — that switches between three panes:

- **Chat** (default) — existing `ChatPanel`, unchanged.
- **Collabs** — existing `WorkshopCollabsPanel` rendered in the side rail.
- **Gallery** — existing `RoomGallery` in a compact "sidebar" layout: pinned strip on top, per-member accordions below. Uses the same `members` list already computed for the tile grid; `onOpenWork` routes into the Screening Mode (see §2) rather than opening a modal.

State: `const [side, setSide] = useState<"chat"|"collabs"|"gallery">("chat")` inside `FullscreenRoom`. On mobile the existing "Chat" sheet button becomes a segmented "Chat · Collabs · Gallery" sheet with the same three tabs.

No new components; the three panels already exist. This unblocks the user's #1 request.

## 2. Screening Mode (lounge-wide, casual, asynchronous)

A new stage layout mode for the fullscreen room. When active, the Stage area plays the embedded video of a published Work everyone in the lounge can see. Playback is **per-viewer / independent** — each user's player has its own transport, no host-forced sync. This matches "casual, asynchronous, not a listening party".

### What can be screened

Only `works` where `status = 'published'` AND `embed_url IS NOT NULL`. Works without a playable embed (image-only, PDF, etc.) get a "Not screenable" tooltip on their pin's Watch button.

### How it's set

Two lounge-wide states, both stored on `instant_rooms`:

- `pinned_work_ids uuid[]` — replaced by the existing `instant_room_work_pins` table (nothing new; it's already lounge-wide and realtime-subscribed).
- `screening_work_id uuid null` — **new column** on `instant_rooms`, pointer to the work currently on the Screening stage. Nullable; when null, Screening Mode is not active.

Any lounge participant can:
- Pin (up to the existing per-user cap: 1 guest pin, host pins unlimited-up-to-limit).
- Start screening: sets `screening_work_id` to that work. Only pinned works are screenable — enforced server-side against `instant_room_work_pins.room_id = screening.room_id AND work_id = screening.work_id`. Rationale: pinning is the deliberate "put this in the room's shared attention" act. This also naturally caps the visible screenable list.
- Stop screening: sets `screening_work_id` back to null. Anyone in the room can stop (matches the casual tone; if this proves noisy we can restrict later).

### UI touch points

- **Pinned strip** in fullscreen: reuse the existing pinned list from `RoomGallery`, rendered as a slim horizontal strip pinned above the Stage (like the current `pinned` slot at the top of the non-fullscreen media panel, line 788 of `channel-view.tsx`). Each item shows cover thumb + title + a **Watch** button (Play icon) when `embed_url` is present, plus **Unpin**. When a work is currently screening, its item shows a glowing "Now screening" ring and the Watch button becomes **Stop**.
- **Stage**: when `screening_work_id` is set, the Stage renders an iframe of `embed_url` inside the existing stage container (same rounded frame as screen-share). Above the iframe: work title + creator handle + "Open work" link → `/works/{slug}`. Screen-share still wins if someone shares (screening pauses visually; the pointer isn't cleared so it resumes on stop).
- **Layout segmented control**: extend the existing Stage / Grid / Tool segmented control (media-panel.tsx line 638) with a **Screening** option, enabled only when `screening_work_id` is set. Selecting it forces stage layout with the embed.

### Realtime sync

`instant_rooms` already has RLS + realtime enabled elsewhere in the app. Subscribe on the client to `postgres_changes` for the room row (or just poll it inside the existing `["instant-room", id]` query at 5s cadence — it already fetches the room). Whichever is cheaper for the current stack; poll is fine for v1 since the room query already runs every 5 seconds.

## Files & changes

- **DB migration** (`supabase/migrations/<ts>_lounge_screening.sql`):
  - `ALTER TABLE public.instant_rooms ADD COLUMN screening_work_id uuid NULL REFERENCES public.works(id) ON DELETE SET NULL;`
  - No new RLS policy (screening pointer is read via existing room read policy; write via server fn only using `supabaseAdmin`).
- **New server fn**: `src/lib/room-screening.functions.ts`
  - `startScreening({ roomId, workId })` — validates: caller is present in room, work is published, work has `embed_url`, work is already pinned in room. Writes `screening_work_id`.
  - `stopScreening({ roomId })` — validates presence. Writes NULL.
- **New component**: `src/components/screening-stage.tsx` — renders the embed iframe with the title/creator/link header.
- **Edits**:
  - `src/components/media-panel.tsx` — extend `FullscreenRoom` with:
    - `side` state + segmented control replacing/wrapping the current `<ChatPanel>` mount.
    - New `layoutMode === "screening"` branch that renders `<ScreeningStage>`.
    - Wire `screening_work_id` prop.
    - Add pinned strip above the stage using the same pins query as `RoomGallery`.
  - `src/components/channel-view.tsx` — pass `screeningWorkId` and pinned works down; wire `onOpenWork` in the fullscreen Gallery to start screening instead of opening the works page.
  - `src/routes/lounge.$id.tsx` — surface `room.screening_work_id` on the `Room` type and thread through `<ChannelView>`.
  - `src/components/room-gallery.tsx` — add a **Watch** button next to Pin on each work when in fullscreen context; disabled with tooltip when `embed_url` is null.
- **Types**: regenerate `src/integrations/supabase/types.ts` via migration.

## Out of scope

- Synchronized/host-controlled playback (users asked for casual/async explicitly).
- Live comments overlaid on the video (Chat panel already covers verbal + text talk-over).
- Non-published works, external URLs the user pastes freehand, or file uploads to the lounge.
- Time-based analytics on watch behavior.

## Known limitations

- Embeds honor whatever the origin allows (YouTube/Vimeo etc. must permit iframe embedding). Works with a blocked embed will just show the provider's "unavailable" state — we don't proxy or transcode.
- Anyone in the lounge can stop the current screening (5-seat casual room — that's the design). Can add a "started by X · only they can stop" rule later if abuse shows up.
