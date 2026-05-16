# Launch UI Tightening

## 1. Homepage hero: dead simple, two big buttons

Rebuild `src/routes/index.tsx` so the **first viewport** is a clean hero with just:
- The "A creative collaboration network" chip
- Headline "Find people. *Make the thing.* Show the Work."
- One-line tagline
- **Two large action cards** (side-by-side desktop, stacked mobile), each with icon + bold label + 1–2 line description:
  - **Join an Instant Workshop** → `/instant` — "Drop into a live room with up to 5 artists right now. Voice or video, no scheduling."
  - **Schedule a Workshop** → `/workshops/new` — "Pick a time, set a prompt, invite collaborators. Ship something on a clock."
- "Post a Collab" button removed.

Cards are large (~180px min-height), rounded-2xl, hover lift. Instant = primary fill; Schedule = surface/outline — equally weighted.

## 2. Ambient warm video background

Behind the hero only, full-bleed muted looping video with a warm cream gradient veil for type contrast.

Pipeline:
1. Three 10s / 1080p / 16:9 clips via `videogen--generate_video`, warm / golden-hour / soft / slightly desaturated, no people, no text, subtle camera drift:
   - Painter's studio — easel, brushes in jars, dust motes in window light
   - Darkroom — red safelight, prints in developer trays
   - Ceramics studio — wet clay on a slowly turning wheel, shelves of bisque pots
2. Stitch into one seamless ~28s loop via `ffmpeg` xfade between clips → `public/ambient/studios-loop.mp4` + `.webm` + poster JPG.
3. Render as `<video autoPlay muted loop playsInline preload="auto" poster=...>` absolutely positioned `object-cover` behind the hero, warm gradient overlay on top.
4. Honor `prefers-reduced-motion` — show poster only.

## 3. Below the fold (kept sections, in order)

After the hero viewport, keep these sections so they're scrolled-to, not crowding the top:
1. **Works Gallery** (full controls + grid) — you'll populate with your own work
2. **City Meetups strip** — kept for near-launch
3. **Upcoming Workshops** card — kept (single card now that Collab is removed; will sit alone or full-width)

Removed from homepage:
- Featured Creators strip
- Live Now strip
- "Collab Board" card

## 4. Hide Collab for v1 (hide-only)

- `src/components/top-nav.tsx`: remove "Collab Board" nav link and "Post a Collab" dropdown item.
- Homepage drops all Collab references.
- `/collab/*` routes, components, DB tables untouched — easy to restore.

## Technical details

- Edited: `src/routes/index.tsx`, `src/components/top-nav.tsx`
- New: `public/ambient/studios-loop.mp4`, `studios-loop.webm`, `studios-loop-poster.jpg`
- Tools: 3× `videogen--generate_video`, one `ffmpeg` stitch via `code--exec`
- No DB changes, no new deps, no route deletions
