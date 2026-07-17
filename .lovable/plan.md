## Problem
On laptop-height screens (≈900px tall) the Lounge desktop chat container is fixed at `h-[60vh]`, which combined with the video stage (max 70vh) pushes the composer below the fold. On tall desktop monitors current sizing is perfect.

## Fix
Replace the fixed `h-[60vh]` with a responsive clamp so the container shrinks on laptop viewports and matches today's height on tall monitors — no changes to video, sidebar, or mobile fullscreen shell.

**File:** `src/components/channel-view.tsx`

Change all five occurrences (lines 956, 965, 986, 1003, 1018) from:
```
h-[60vh]
```
to:
```
h-[clamp(320px,46vh,560px)] xl:h-[60vh]
```

Result:
- Short laptops (~800–900px tall): ~46vh (≈380–415px) → composer visible without scroll
- Tall desktops (≥1280px wide, typically ≥900px tall): reverts to `60vh` exactly as today
- Never smaller than 320px, never larger than 560px on laptop range

## Scope
- Desktop chat/gallery/collabs/links/tools tab containers only
- No changes to VideoStage, sidebar, mobile `FullscreenRoom`, or any logic
