# Gradient speaking ring on Lounge stage bubbles

Replace the current subtle primary ring + slight scale on `SpeakerBubble` with an obvious rotating warm-gradient halo around the avatar circle, using the site's existing `gradient-warm` palette (coral → orange).

## What changes

- `src/components/media-panel.tsx` → `SpeakerBubble`:
  - When `speaking` is true, wrap the avatar in a slightly larger circular halo that renders the workshop warm gradient (`linear-gradient(135deg, coral → orange → red-orange)`) with an inner mask so it reads as a ring, not a filled disc.
  - Add a soft outer glow (`box-shadow` in coral) so the effect is unmistakable next to non-speaking bubbles.
  - Gentle continuous rotation/pulse of the gradient (~3s) so it feels alive without being distracting; respects `prefers-reduced-motion`.
  - Remove the plain `ring-primary` + inner `animate-pulse` overlay; keep the neutral `ring-border/60` state when idle.
  - Muted mic badge stays anchored to the avatar (not the halo) so it doesn't drift.

- `src/styles.css`:
  - Add a small `.speaking-halo` utility + `@keyframes speaking-halo-spin` (conic/linear warm gradient, `animation` gated by `@media (prefers-reduced-motion: no-preference)`).

No other components change; `WebcamTile` / `PeerAudioTile` etc. keep their existing ring since the request is specifically about the avatar bubbles on the stage.

## Technical notes

- Halo uses a wrapper `div` at ~`h-16 w-16` (for `lg`) with `background: var(--gradient-warm)` and a masked inner circle (`padding: 2.5px` + inner white/surface disc) so we don't need pseudo-elements on the existing avatar.
- Colors reuse existing tokens from `.gradient-warm` in `src/styles.css` — no new palette.
- Speaking state already flows through `SpeakerBubble` from `channel-view.tsx` / `media-panel.tsx`; no data plumbing changes.
