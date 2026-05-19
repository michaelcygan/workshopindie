## Replace Hero video with ethereal animated gradient background

Goal: swap the "studios-loop.mp4" background in the homepage Hero (`src/routes/index.tsx`) for an OpenAI/Stripe-style ambient background — soft, modern, slowly morphing amorphous color blobs that crossfade between several palettes.

### Approach: pure CSS/SVG, no video file

Rather than generating MP4s (heavy, palette-locked, hard to iterate), build it in code as a self-contained React component. Benefits:
- Instant load, no asset pipeline, perfectly crisp at every resolution
- Easy to add/edit palettes later
- Respects `prefers-reduced-motion`
- Matches the "subtle, ethereal, not too saturated" brief precisely

### What it looks like

3–4 large radial-gradient "blobs" (~60–80vmax each), heavily blurred (`filter: blur(80–120px)`), absolutely positioned and slowly drifting + scaling via long keyframe animations (40–60s loops, different durations so they never resync). A faint grain/noise overlay at low opacity for the OpenAI-style organic feel. A `bg-background/70` veil (already there) preserves text contrast.

3 palettes that crossfade every ~12s:
1. **Sky/Peach/Cream** — pale blue → warm yellow → soft peach (like screenshot 1)
2. **Coral/Sky** — coral pink → sky blue → cream (like screenshots 4/5)
3. **Teal/Green/Navy** — deep teal → muted green → midnight (like screenshot 3)

Each palette is a stacked layer; opacity animates on a shared timeline so one fades out as the next fades in, looping seamlessly.

### Files

**New:** `src/components/ethereal-background.tsx` — self-contained component returning the layered blobs + grain. All animation via CSS keyframes defined inline or in `src/styles.css`.

**Edit:** `src/routes/index.tsx` — replace the `<video>` + fallback `<img>` block (lines ~50–67) with `<EtherealBackground className="absolute inset-0 -z-20" />`. Keep the existing `bg-background/70` veil and `gradient-soft` overlay for text contrast.

**Edit:** `src/styles.css` — add keyframes (`blob-drift-1/2/3`, `palette-cycle`) and a `.grain` utility (tiny inline SVG noise data URI).

**Optional cleanup:** leave `/public/ambient/studios-loop.mp4` + poster in place for now (no other route uses them per grep); can be deleted in a follow-up.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` freezes all animations and shows the first palette as a static gradient.

### Out of scope

- No changes to hero copy, buttons, category strip, or anything below the fold.
- No new dependencies.
- No backend / data changes.

Approve and I'll implement.