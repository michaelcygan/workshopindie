# Screen Share PiP — Director Mode (distilled v1)

Two changes. Both frontend-only. No schema, no new realtime.

## 1. Label the shared window

The share surface currently reads "You're sharing your screen" with no app name. Read `videoTrack.label` from the screen track and append it: **"You're sharing — Apple Music"**. Same for remote: **"Michael's screen — Ableton Live"**. Fallback to "Shared window" when the browser hides the label.

- File: `src/components/media-panel.tsx`

## 2. Director PiP (when a screen is being shared)

The existing pop-out button stays the same. When a screenshare is active, the PiP body swaps to a **Director** layout with **3 view presets** and the existing in-PiP mic/cam/return controls.

```text
┌──────────────────────────────┐
│  [ Stage preview ]           │
│                              │
├──────────────────────────────┤
│ [1 Tool]* [2 Split] [3 Cam]  │
│ ● Mute  ● Cam  ⌞ Return      │
└──────────────────────────────┘
```

Presets and what they do to **the room's stage** (not just the host's PiP):

1. **Tool** — full-bleed shared screen (default; today's behavior).
2. **Split** — shared screen + host camera inset (PiP-style overlay, bottom-right).
3. **Cam** — host camera full-bleed, screenshare paused visually.

How switching works: a single `<canvas>` composes the chosen layout at 12fps; its `captureStream()` replaces the outbound screenshare track via `RTCRtpSender.replaceTrack`. Preset 1 swaps back to the raw screen track (no canvas overhead in the common case). Keyboard `1`/`2`/`3` cuts between them.

### What we cut from the earlier plan (and why)
- **4th saveable preset** — adds a "bind current state" interaction model that needs its own affordances and persistence. Ship 3 fixed presets first; add custom slots once we see which combos people actually use.
- **localStorage persistence** — nothing to persist with fixed presets.
- **Tool-audio remix via AudioContext** — keep the existing screenshare audio path; don't introduce a Web Audio mixer in v1.
- **New `replaceOutboundVideoTrack` helper** — only add if the hook doesn't already expose it; otherwise call `replaceTrack` directly where we already swap screen tracks.
- **Long-press / "save current view" gesture** — deferred with the 4th slot.

### What stays
- Director only activates when a share exists; otherwise PiP keeps today's Me/Speaker/Tool body.
- One PiP per host. Same pop-out button. Same browser support gate.

## Files touched
- `src/components/media-panel.tsx` — track label.
- `src/components/workshop-pip.tsx` — mode routing + Director body (keep it in this file; no new file needed for 3 presets).

## Out of scope (v1)
Custom/saved presets, multi-window PiP, server-side composite recording, Safari fallback, cropping/zoom, audio remixing.
