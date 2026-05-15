## Instant Workshop — v5 polish

### 1) Always join with both audio + video when both devices exist

**`src/routes/instant.index.tsx`** — when both mic and camera are detected, default mode is `"video"` (currently defaults to `"voice"` whenever a mic exists, so video never streams in even though browser allowed it). Mode logic becomes:
- both mic + cam → `"video"`
- mic only → `"voice"`
- cam only → `"video"`

The existing pre-flight `getUserMedia({ audio, video })` already requests both — no change there. The room then auto-joins in `video` mode, capturing both tracks.

### 2) Standardize video tiles to a 5-up row (no monopoly)

**`src/components/media-panel.tsx` → `VideoStage`** — replace the `total <= 1 ? grid-cols-1 ...` adaptive grid with a fixed 5-column stage so every tile is the size one of five would be. Render only occupied tiles (no empty placeholders). On narrow viewports collapse responsively:
- `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`
- Each tile keeps `aspect-video` so a single video no longer fills the whole stage; it stays sized at ~1/5 width with the rest of the row empty.
- Stage gets a min-height equal to one tile so the layout doesn't jump as people join/leave.

### 3) Fullscreen / video-forward view

Add a fullscreen toggle on the stage:
- Header bar inside `VideoStage` with a `Maximize2 / Minimize2` button (top-right overlay).
- When fullscreen: stage takes the whole viewport (`fixed inset-0 z-50 bg-ink`), tiles use a larger grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` capped at 5 visible), and a floating control bar (Mute / Camera / Exit / Minimize) sits at the bottom-center. Chat + side panel hidden in this mode.
- State lives in `ChannelView` (`fullscreen` boolean) and is passed to `VideoStage` + `MediaPanel`. Esc key exits fullscreen.
- Use the browser Fullscreen API (`requestFullscreen` / `exitFullscreen`) on the stage container in addition to the CSS overlay so the user gets a true OS-level fullscreen if they want it.

### Files touched
- `src/routes/instant.index.tsx` — default mode logic
- `src/components/media-panel.tsx` — fixed 5-col `VideoStage`, fullscreen mode + button, floating controls
- `src/components/channel-view.tsx` — own `fullscreen` state, hide chat/sidebar when active, Esc handler

### Out of scope
- Scale work (SFU, Realtime sharding) from the prior audit
- Picture-in-picture, screen share, background blur