# Workshop Picture-in-Picture

Add a "Pop out" button next to the existing Expand (Maximize2) icon in the workshop channel view. Clicking it opens a native floating Document PiP window that follows the workshop — by default showing self video with room audio, plus a toggle for active-speaker video or the current tool/shared surface.

## UX

Header area of `channel-view.tsx` (the absolute-positioned button cluster top-right of the main stage, currently just `Expand chat`):

```text
[ PiP ⧉ ] [ Expand ⛶ ]
```

- Button shows a `PictureInPicture2` lucide icon, tooltip "Pop out".
- Disabled with tooltip "Pop-out isn't supported in this browser" when `window.documentPictureInPicture` is missing (Safari/Firefox today).
- Clicking opens a Document PiP window (~360×260) containing:
  - A compact source selector chip row: **Me · Speaker · Tool**
    - **Me**: local camera preview + room audio element (default)
    - **Speaker**: auto-follows whichever peer's `peer.speaking` is true (falls back to last active speaker; "—" placeholder if silence)
    - **Tool**: clones the active tool surface (player iframe poster / shared screen video) — for `player` tool, render the same `EmbedPlayer` URL; for screenshare peer, attach that stream
  - Small label strip with speaker name + mic indicator
  - A "Return" button that closes PiP and refocuses the tab
- Closing the PiP window (native close or "Return") restores normal state. Closing the workshop tab/route also closes the PiP window.
- Audio: a single hidden `<audio>` element in the PiP window plays the mixed room audio (reused from existing media context); video element switches its `srcObject` when the source selector changes.

## Trigger & state

- Manual only — no auto-on-blur in v1.
- One PiP instance per tab. Opening again while open just refocuses it.

## Technical

- New component `src/components/workshop-pip.tsx` exporting:
  - `useWorkshopPip({ media, meStream, meDisplay, profileLookup, activeTool })` → `{ supported, open, isOpen, close }`
  - Internally calls `window.documentPictureInPicture.requestWindow({ width: 360, height: 260 })`, then renders a React subtree into the PiP document via `createPortal`. Copies current `<style>`/`<link rel="stylesheet">` nodes into the PiP document head so Tailwind classes apply.
  - Listens to `pagehide` on the PiP window for cleanup.
  - Source state: `'me' | 'speaker' | 'tool'`, persisted in `useState` (not across sessions).
  - Active speaker: derived from `media.peers.find(p => p.speaking)`, memoized with a 750ms hold so the tile doesn't flicker between words.
- Wire-up in `src/components/channel-view.tsx`:
  - Import `PictureInPicture2` from lucide-react and `useWorkshopPip`.
  - Render new button immediately left of the existing Expand button (lines ~527–535) using the same styling.
  - Pass existing `media`, `meDisplay`, `profileLookup`, plus the current tool descriptor (already known from `viewMode`/`toolsSlot` — pull the active player URL from the `player` tool state if present, else `null`).
- Type declaration: add `src/types/document-pip.d.ts` with the `DocumentPictureInPicture` interface (TS lib doesn't yet ship it).
- No backend, no schema, no new dependencies.

## Out of scope

- Auto-pop on tab blur (can add later behind a settings toggle).
- PiP fallback in browsers without Document PiP (Safari/Firefox get the disabled button + tooltip).
- Multi-tile composite ("whole stage") — single source at a time in v1.
- Recording / streaming the PiP output.

## Files

- New: `src/components/workshop-pip.tsx`, `src/types/document-pip.d.ts`
- Edit: `src/components/channel-view.tsx` (add button + hook wiring only)
