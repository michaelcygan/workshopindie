# Lounge as the first-class "all" topic

Rename the general / matchmaker workshop from **Any topic** to **Lounge** throughout the discovery module, and make it a distinct, pinned-first entry in both the "By topic" list and the "Jump straight into" popover — so it reads as a real destination, not an abstract catch-all.

## Changes

### 1. Rename the featured card
`src/components/live-topics-list.tsx`
- Headline: `Any topic` → `Lounge` (both split + stack layouts).
- Sub-copy tightened to match the new noun:
  - Live: "Drop in where the conversation's already going."
  - Empty: "Open the room — the night starts here."
- Eyebrow unchanged (`Live now · N` / `Start the night`).

### 2. Pin Lounge first in the "By topic" list, with distinct style
Same file.
- Inject a synthetic `lounge` row at the top of `sorted` (not from `CATEGORIES`, so it stays out of medium-typed flows).
- Sort order: Lounge always first; remaining mediums sorted by live count as today.
- Distinct visual treatment for the row:
  - Faint hairline gradient backdrop (`gradient-motion` at low opacity behind the row, like the featured card's top edge).
  - Eyebrow chip "GENERAL" in `text-[9.5px] uppercase tracking-[0.14em]` next to the label.
  - Slightly heavier label weight; description uses TOPIC_DESCRIPTIONS-style copy: *"Mixed-medium drop-in. Whoever shows up."*
  - Live count + avatar stack work exactly as other rows (sums across all lounge rooms — `rooms.filter(r => !r.medium)`).
- Click handler: `onPick(null)` (same as the featured CTA), so behavior is identical to "Match me to a seat".
- Keyboard nav (`data-row`) still works.

### 3. Add Lounge to the "Jump straight into" popover (first item)
Same file, `SplitOpenButton`.
- Prepend a synthetic `{ id: "lounge", label: "Lounge" }` to the rendered list above `CATEGORIES`.
- Live count from the same `rooms.filter(r => !r.medium)` aggregate (thread it into `SplitOpenButton` alongside `liveByMedium`).
- Click calls `onPickAny()` (existing handler).
- Visually: same row style as other mediums, no extra divider.

### 4. Header copy nit
`src/routes/workshop.index.tsx` — wherever copy says "Any topic" in headlines, surrounding paragraphs, or empty states for this module, change to "Lounge". (Leave internal symbols/functions like `joinLounge` untouched — they already match.)

## Out of scope
- No changes to `joinLounge` / `joinMediumLounge` server functions or DB.
- No changes to marquee, host card, or the rest of the page.
- No new categories in `src/lib/categories.ts` — Lounge is a presentation-only row, not a medium.

## Files touched
- `src/components/live-topics-list.tsx`
- `src/routes/workshop.index.tsx` (copy only, if any "Any topic" strings remain)
