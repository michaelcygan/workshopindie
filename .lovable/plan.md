# Workshop Polish v1 — Stage, Recorder, PiP, Fullscreen

Four scoped frontend changes plus a small product framing. All v1 — no schema changes, no new dependencies, no new realtime channels. Built to stay cheap at 10–100k DAU because every change is presentation-layer over streams/state we already have.

---

## 1) Clean up the room dock (`src/components/media-panel.tsx` → `CompactRoom`)

Today the right-rail control card shows: **Mute · Camera off · Share screen · Exit**. Per your direction, screen share should live **only inside the Tools tab** so it stays additive — not a competing way to be "seen".

Changes:
- Remove the "Share screen" button from `CompactRoom` (lines ~115–122).
- The empty slot is replaced by **New** (skip to the next live Workshop) — same icon/tooltip as the existing `HopButton`, but rendered as a dock button matching Mute / Camera off / Exit. Wire it to the existing `joinLounge` server fn already imported in `channel-view.tsx`; lift the handler or pass it through props so the dock can call it.
- Order becomes: `Mute · Camera off · New · Exit`. Exit stays the destructive-styled one on the right.
- The top-right title row in the workshop header keeps its existing `HopButton` (no duplication needed because the dock is what people reach for mid-call). If you'd rather, we drop the header `HopButton` once the dock version ships — flag this and I'll remove it in the same change.
- Discoverability for screen share: when no one is sharing, show a one-line hint inside the Tools tab header ("Share your screen from Tools → Screen Share") — zero added widgets in the dock.

Why: screen share is now strictly **additive content**, never a substitute for presence. Camera tiles are always the source of truth for "who's here".

---

## 2) Recorder live state — collapse setup, expand playback (`src/components/workshop-recorder.tsx`)

When `recording === true`, the Sources list is locked anyway (already enforced via `disabled={recording}`), so it shouldn't dominate the panel. Redesign the live state:

- **Collapse** the Sources picker into a single summary chip row: `🎙 Mic · 📷 My room camera · 🎬 Screen` — tap to expand back into the full list (rare).
- **Promote** a center-stage **Now Recording** block that fills the freed space:
  - Big live waveform for the active mic (Web Audio `AnalyserNode` on the mic track — same hookup the dock VU already has).
  - Live thumbnail preview of the camera/screen source(s) via a small `<video>` mirroring the same `MediaStream`.
  - Prominent `REC 0:44` clock + take number (`Take 03`).
  - One primary action: **Stop & save**. Secondary: **Mark moment** (timestamp pin, stored in local component state for v1 — visible chips above the timeline; persistence to DB is post-v1).
- Keyboard: `Space` toggles Mark moment, `Esc` stops. Tooltipped on hover.
- Mobile: the collapsed source chips stack horizontally and scroll; the playback block stays full-width above the dock.

No new data model. All within the existing recorder component, gated on the existing `recording` boolean.

---

## 3) PiP power features (`src/components/workshop-pip.tsx`)

Building on what already works. Each one is additive and small:

- **Tool source**: ship the `'tool'` chip referenced in the original plan. When the active workshop tool is a `player` (YouTube/etc.) or a peer screenshare, the PiP video element switches to that stream. Falls back to a "No tool active" placeholder.
- **Stage source**: a new chip **Stage** that composes a 2x2 / 3x2 grid of all peers into a single `<canvas>` (drawn at 12 fps via `requestAnimationFrame`, captured with `canvas.captureStream(12)`). Cheap on CPU because we composite locally from streams the page already has.
- **Auto-follow speaker**: a small toggle (`Follow speaker`) under the chip row. When enabled with source = Speaker, the sticky-speaker hold extends to 1.5s and the speaker name pill animates. Default off.
- **Quick controls** inside PiP: mute toggle and camera toggle, so the user can react without un-popping. Wired to the same `media.toggleMute` / `media.toggleCamera` already in context. Two small icon buttons left of "Return".
- **Smart resize**: remember the last PiP window size in `localStorage` (`pip:size`) and reuse on next open.
- **Tab integration**: if the user closes the workshop tab while PiP is open, the existing `pagehide` cleanup already handles it — add a `beforeunload` confirm only when actively recording.

Skipped from v1 (note for later): screen-share-back from PiP, multi-window PiP, OS-level PiP fallback for Safari/Firefox (still shows the disabled-button tooltip).

---

## 4) Multiplayer Fullscreen Stage (`FullscreenRoom` in `src/components/media-panel.tsx`)

Today fullscreen is "tiles + chat". Extend it into a true workshop stage so a host can run, e.g., an Ableton bootcamp end-to-end without leaving fullscreen.

New layout (desktop ≥ lg):

```text
┌────────────────────────────────────────────────────────────┬─────────┐
│  [ TOOL / SHARED SCREEN — large 16:9 surface ]             │  CHAT   │
│                                                            │         │
│                                                            │         │
├────────────────────────────────────────────────────────────┤         │
│  [tile][tile][tile][tile][tile]  ← filmstrip, max 5        │         │
└────────────────────────────────────────────────────────────┴─────────┘
                       [ Mute · Cam · New · Exit ]  ← floating dock
```

- **Tool surface**: top region renders the currently active tool. If a peer is screensharing, it shows their screenshare stream. Otherwise it shows whichever tool the user has open from the Tools tab (Player iframe, Docs, etc.) via the same `toolsSlot` ref the side panel uses — extracted to a small `WorkshopStage` component that both views consume so we don't duplicate logic.
- **Filmstrip**: peers reflow to a single horizontal strip of up to 5 thumbnails, speaker is auto-highlighted with a 2px ring (using the same `speaking` boolean we already broadcast).
- **Chat**: persistent right rail at `lg`, drawer on mobile (already present — keep as-is).
- **Layout toggle**: top-right button cycles `Stage · Grid · Tool-only`. `Grid` is the current behavior; `Tool-only` hides the filmstrip for distraction-free demos.
- **Reactions bus**: tiny emoji reaction tray (👏 🔥 💡 ❓) that fires a Realtime broadcast on the room's existing channel and renders floating emoji over the sender's tile for 1.5s. No DB writes, throttled to 1/s/user client-side. Cheap at scale — broadcast only fans out to the room (≤5 peers).
- **"Raise hand"**: same channel, sets a per-user flag in local state across the room; the host sees a hand badge on the tile and a list in chat header.
- Keep the existing dock; add **New** here too (per #1).

Why this scales:
- All composition is client-side. No new server fanout beyond the room broadcast channel we already pay for.
- Tool surface is a pointer to existing DOM — no duplicate iframes/streams.
- Reactions use the existing host-events Realtime channel pattern (`HostRoomEvents`), one shared channel per room.

---

## 5) Product framing — bootcamp mode (no code this turn, just direction)

With PiP + multiplayer fullscreen, the platform now supports the "live bootcamp" pattern you described (everyone in Ableton, host's screen on the stage, chat persistent, PiP follows speaker). For v1 we don't need a separate "bootcamp" mode — the same Workshop room covers it. Post-v1 candidates worth queuing:

- A "host" indicator badge that pins the host's tile to the stage when no screenshare is active.
- Saved "stage presets" per workshop (Grid vs Stage vs Tool-only) so recurring sessions open in the same layout.
- Per-room ephemeral whiteboard tool (Excalidraw embed) — fits neatly into the existing Tools tab.

---

## Files touched

- `src/components/media-panel.tsx` — remove Share screen from CompactRoom, add **New** dock button, extend FullscreenRoom into stage layout + reactions + layout toggle.
- `src/components/workshop-recorder.tsx` — collapsed Sources + expanded live playback block when recording.
- `src/components/workshop-pip.tsx` — Tool/Stage sources, follow-speaker toggle, in-PiP mute/cam controls, remembered window size.
- `src/components/channel-view.tsx` — pass `onJoinNew` / handler down to the dock; optionally remove the header `HopButton` once the dock has it.
- New: `src/components/workshop-stage.tsx` — small shared component for the tool/screenshare surface, reused by Tools panel and FullscreenRoom.
- New: `src/components/room-reactions.tsx` — emoji bus over the existing room Realtime channel.

No backend changes. No new dependencies.

## Out of scope (flagged for later)

- Persisting "Mark moment" timestamps to DB.
- Multi-window PiP / Safari PiP fallback.
- Server-side composited recording of the stage view.
- Host pinning, stage presets, embedded whiteboard.
