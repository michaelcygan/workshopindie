## What's wrong now

1. I added extra "Maximize" buttons inside the Board header and the Gallery toolbar. Those should not exist.
2. The persistent top-right expand button on the main module (currently only on `VideoStage`) always opens chat fullscreen — it should open whichever surface is currently selected (chat / board / gallery).
3. The Board and Gallery fullscreen overlays render only the surface — no video tiles, no presence bubbles. They should keep the same participant presence row that chat fullscreen has, so you can still see who is in the room.

## The fix

### 1. One contextual expand button (channel-view.tsx)

- Remove the extra "Enter fullscreen" buttons I added inside `RoomBoard` and `RoomGallery` (and drop the `onEnterFullscreen` props from both).
- Collapse `fullscreen` + `fsSurface` state into a single `fsView: null | "chat" | "board" | "gallery"`.
- Wire `VideoStage`'s `onEnterFullscreen` (and a fallback expand button rendered above the main module when `VideoStage` isn't visible) to `setFsView(viewMode === "whiteboard" ? "board" : viewMode === "gallery" ? "gallery" : "chat")`.
- Because the expand control is now persistent regardless of whether anyone has camera on, lift the expand button out of `VideoStage` into a small absolutely-positioned control on the main module shell (top-right corner of the left card), and keep `VideoStage` unchanged otherwise. The button icon stays `Maximize2`; tooltip reflects the active mode ("Expand chat" / "Expand board" / "Expand gallery").

### 2. Fullscreen Board & Gallery include presence (fullscreen-shell.tsx + channel-view.tsx)

- Extend `FullscreenShell` to accept an optional `presence` slot rendered as a thin horizontal strip above the body (small tiles: video where available, otherwise an avatar bubble with the participant's display name + speaking ring + mute dot — same `VideoTile`/`AudioTile` primitives used in `FullscreenRoom`).
- In `channel-view.tsx`, when rendering the board/gallery fullscreen overlays, pass a memoized `presenceTiles` array built from `media.peers` + `others` + the local user (mirrors the `tiles[]` construction in `FullscreenRoom`, but laid out as a single scrollable row, ~96px tall).
- Tiles stay live: same `MediaState` is passed in, so video streams keep playing and speaking indicators keep updating.

### 3. Chat fullscreen unchanged behavior

- The existing `FullscreenRoom` already shows the unified tile grid + chat, so the only change here is that it's triggered from the same single contextual button.

## Files touched

- `src/components/channel-view.tsx` — collapse fullscreen state, route the persistent expand button by `viewMode`, build presence tiles, render new shell variant for board/gallery.
- `src/components/fullscreen-shell.tsx` — add `presence` slot row above the body.
- `src/components/room-board.tsx` — remove the inline `Maximize2` button + `onEnterFullscreen` prop.
- `src/components/room-gallery.tsx` — remove the inline fullscreen toggle + `onEnterFullscreen` prop.
- `src/components/media-panel.tsx` — `VideoStage` no longer renders its own expand button (the parent owns it now), but keep `VideoStage` otherwise intact.

## Out of scope

- No DB / realtime / RLS changes.
- No new dependencies.
- Visual styling matches the existing chat fullscreen (dark `#0a0a0a` shell, same tile primitives).
