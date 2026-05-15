## Fullscreen v2 — beautiful, complete room view

Goal: fullscreen becomes a true "in-the-room" view, not just a video stage. All participants visible (video tiles + audio-only avatar tiles), live chat docked to the side, polished dark aesthetic.

### Layout (desktop ≥ md)

```text
┌─────────────────────────────────────────────────────────┐
│  INSTANT WORKSHOP · 3/5                       ⤡ minimize│  ← top bar
├──────────────────────────────────────┬──────────────────┤
│                                      │  CHAT            │
│        Participant tile grid         │  ┌────────────┐  │
│   (videos + audio-only avatars       │  │ messages…  │  │
│    in the same uniform grid)         │  │            │  │
│                                      │  └────────────┘  │
│                                      │  [ input ➤ ]     │
├──────────────────────────────────────┴──────────────────┤
│           ⏺ Mute    📷 Camera off    ⎋ Exit              │  ← floating dock
└─────────────────────────────────────────────────────────┘
```

On `< md`: chat collapses into a bottom sheet toggled by a "Chat (n)" pill in the top bar; tile grid fills the screen.

### Tile grid

One unified grid renders **everyone in the room**, video or not:
- Video participant → existing `VideoTile` (aspect-video, mirrored for self).
- Audio-only / camera-off participant → new `AudioTile`: same `aspect-video` shell, dark surface, large centered avatar (or initial), display name, mic-off badge if muted, primary-colored ring when speaking.
- Self always first; peers follow in presence order.
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (caps elegantly at 5 cap). Tiles centered with `max-w-6xl mx-auto`.

### Chat panel (fullscreen)

- Reuses the existing message list + composer rendering (extracted from `ChannelView` into the same component, or inlined into a fullscreen branch — message data, send handler, scroll ref already live in `ChannelView`).
- Fixed width `w-[340px]` on `lg+`, glassy panel: `bg-background/5 backdrop-blur border border-background/10 rounded-2xl`.
- Same Send button + Input. Placeholder "Say something…".
- Scrolls independently; auto-scrolls on new messages (existing effect already covers this).

### Top bar + dock styling

- Top bar: small `Radio` icon, "INSTANT WORKSHOP · n/5" in muted background-foreground, minimize button on the right (already exists).
- Floating dock: `fixed bottom-6 left-1/2 -translate-x-1/2`, pill-shaped `bg-background/10 backdrop-blur border border-background/15 rounded-full px-2 py-2`, three buttons (Mute / Camera / Exit). Subtle entrance fade.
- Chat-toggle pill (mobile only) lives in the top bar.

### State / wiring

- `ChannelView` already owns `fullscreen`, messages, presence, draft. Pass these into `VideoStage` (or rename to `RoomStage`) so the fullscreen branch can render the chat. Simplest: keep `VideoStage` as-is for the inline (non-fullscreen) case; add a new `FullscreenRoom` component in `media-panel.tsx` that takes `m`, presence, profileLookup, messages, draft state, send handler, onExit, onMinimize. `ChannelView` renders `<FullscreenRoom … />` when `fullscreen === true`, otherwise the existing inline layout.
- Esc-to-exit + body scroll lock while fullscreen (add `overflow-hidden` to `document.body` via effect).

### Files touched

- `src/components/media-panel.tsx` — add `AudioTile`, add `FullscreenRoom` (tiles + chat + dock + top bar). Trim fullscreen branch out of `VideoStage`; keep `VideoStage` for inline mini-stage only.
- `src/components/channel-view.tsx` — render `<FullscreenRoom>` when fullscreen; pass messages, presence, send handler, draft state, profile lookup. Add body scroll-lock effect.

### Out of scope
- New animations beyond simple fades
- Picture-in-picture / screen share
- Reordering or pinning participants