# Audio-only tiles + speaking indicator

The circled empty spots in the video strip are peers who joined without a camera — today `VideoStage` filters them out entirely, so they simply disappear. `AudioTile` already exists (avatar-or-initial placeholder on a dark tile) and is used inside the fullscreen layout, but not in the top strip.

## Changes (all in `src/components/media-panel.tsx`)

1. **`VideoStage` — render audio-only placeholders in the top strip**
   - Also show a tile for the local user when they're joined but camera is off (`m.joined && !m.cameraOn`), using `AudioTile` with their avatar/name and `speaking={m.speaking && !m.muted}`, `muted={m.muted}`.
   - Include audio-only remote peers (`m.peers` where `mode !== "video"` or no `stream`) as `AudioTile`s alongside the video tiles.
   - Apply the same treatment inside the screen-share "spotlight" branch's thumbnail grid so audio-only participants stay visible while someone is sharing.
   - Update the `hasAny` early-return so the strip renders whenever anyone (local or peer) is present, not only when a video track exists.

2. **Speaking indicator — make it obvious**
   - `VideoTile` / `AudioTile`: bump the outer ring from `ring-2` → `ring-[3px]` when speaking, and add a soft pulsing `ring-primary/30` halo so the "band around the window" is unmistakable. Keep the non-speaking state unchanged.
   - `SpeakerRow` (right sidebar): bump the avatar ring from `ring-2` → `ring-[3px] ring-primary` with the same subtle pulse when `speaking` is true, so the "M" circle in the Here-now list clearly bands when that person is talking.

No changes to WebRTC, VAD, presence, or hooks — the `speaking` boolean is already plumbed through `media.peers[i].speaking` and `media.speaking`. This is purely a rendering change in one file.

## Not in scope
- Empty seats (rooms below cap) stay empty — placeholders only appear for people actually connected.
- No new tokens or global CSS; uses existing `primary` semantic color.
