## Fullscreen for Board and Gallery

### The bug
The `Maximize2` button in the Board's floating zoom bar currently calls `applyZoom(1)` — it's a "reset to 100%" button, but the icon looks like fullscreen, so clicking it just changes the zoom while the canvas (a 4000×3000 transformed div) visually overflows behind the room container. That's the "expands behind the container" symptom.

The Board has no real fullscreen state. The Gallery has none either. Only the video stage + chat does, via `FullscreenRoom` in `media-panel.tsx`.

### Plan

**1. Reuse the existing fullscreen pattern**
- `channel-view.tsx` already owns `const [fullscreen, setFullscreen] = useState(false)` with an Esc handler for the video room. Extend that to a single state: `const [fsView, setFsView] = useState<null | "video" | "board" | "gallery">(null)`.
- Keep the Esc-to-exit handler; it now closes whichever view is open.

**2. Add Enter-fullscreen affordance to Board and Gallery**
- Same visual language as `VideoStage`'s overlay button: floating top-right `Maximize2` in a translucent pill (`bg-background/80 ... rounded-full`).
- In `channel-view.tsx`, when `viewMode === "whiteboard"` or `"gallery"` and not already fullscreen, render the inline Board/Gallery inside the normal `h-[60vh]` container with the overlay button.
- Clicking the overlay button calls `setFsView("board" | "gallery")`.

**3. New fullscreen surfaces**
Mirror `FullscreenRoom`'s shell (fixed inset-0 z-50, dark backdrop, top bar with title + count + `Minimize2`, body-scroll lock, motion fade), but render Board or Gallery as the body instead of the tile grid + chat.

- `FullscreenBoard`: full-viewport flex column; header with `INSTANT WORKSHOP · BOARD` label and `Minimize2`; body is `<RoomBoard roomId userId className="h-full" />`. The Board already has its own scroll container and toolbar, so it just fills the space. Zoom controls keep working as-is.
- `FullscreenGallery`: same header; body is `<RoomGallery ... className="h-full" />` with `onOpenWork` wired to the same handler (we proxy through props so the WorkPeek dialog still opens above).

Place both in `media-panel.tsx` next to `FullscreenRoom` (consistent location) OR in a new `src/components/fullscreen-shell.tsx` that exports a shared `<FullscreenShell title onMinimize>{children}</FullscreenShell>` so all three (Room/Board/Gallery) share one chrome. Going with the shared shell — keeps the chat fullscreen header identical and means future surfaces inherit it for free.

**4. Fix the Board's broken button**
- Remove the misleading `Maximize2` "reset zoom" button from the floating zoom bar.
- Replace it by making the `100%` percentage label clickable (click resets to 100%) — minimal, no extra icon confusion.
- The new fullscreen-enter `Maximize2` lives in the Board's *header strip* (next to the "Board · ephemeral" label), not inside the zoom bar, so the two affordances can't be confused.

**5. No backend/data changes.** Pure presentation: state moves up to `channel-view.tsx`, two new fullscreen wrappers, one zoom-bar tweak.

### Files touched
- `src/components/channel-view.tsx` — `fsView` state, conditional render of `FullscreenBoard` / `FullscreenGallery`, Esc handler update.
- `src/components/media-panel.tsx` (or new `fullscreen-shell.tsx`) — extract `FullscreenShell`, add `FullscreenBoard` and `FullscreenGallery` wrappers.
- `src/components/room-board.tsx` — drop the Maximize2 button from zoom bar; add enter-fullscreen button in the header strip (accept optional `onEnterFullscreen` prop); make percentage label reset zoom on click.
- `src/components/room-gallery.tsx` — accept optional `onEnterFullscreen`; render the overlay button when provided.

### Out of scope
- Multi-pane fullscreen (e.g. Board + chat side-by-side). The chat fullscreen already exists separately; users can switch views via the existing pill.
- Pinch-to-zoom / trackpad gesture zoom on the Board.
