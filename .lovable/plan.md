
# Homepage 2027 pass

Goal: make the homepage read like a well-edited magazine instead of a stack of rails. Preserve every current section and CTA. Adopt the editorial card style you liked from the Blog rail (screenshot 2) as the visual anchor, then let each section vary intentionally around it.

## Design direction (the "language")

- **Card style** — adopt the Blog card as the base: 16:10 cover, tiny uppercase eyebrow (date / author / category), display-serif title, one-line dek. Apply to Gallery, Collabs, Events, Upcoming, Blog. Chips move inside the eyebrow, not floating on the cover — that's what's making screenshot 1 feel busy.
- **Section header pattern** — small uppercase kaviar (e.g. `GALLERY · finished work`), one big display title, one line of intent, right-aligned link pill. Same shape every section for rhythm.
- **Whitespace** — bump vertical section padding from py-10/14 to py-14/20; add a hairline `border-t border-border/60` between sections instead of visual dividers. Cream background carries the whole page.
- **Density** — homepage always shows the same count per breakpoint: 3 on desktop, 2 on tablet, 1.15 (peek) on mobile via a snap-scroll. No more mixed grids that jump between 2/3/4 columns per section.
- **Motion** — keep it earned: subtle fade-up on section reveal, cover image scale on hover, no parallax stacks.

## New section order (below hero)

The current order works but competes for attention. Regroup into three acts:

```text
HERO  (unchanged)
─────────────────────────────────────────────
ACT 1 — HAPPENING NOW  (live + your world)
  1. Pulse ticker            (compact, one row)
  2. Lounge                  (sample tiles that swap on join — keep + polish)
  3. Your Groups strip       (auth only, unchanged)
─────────────────────────────────────────────
ACT 2 — WHAT PEOPLE ARE MAKING
  4. Collabs                 (open roles — 3 editorial cards)
  5. Gallery                 (finished work — 3 editorial cards, "Browse all")
  6. From your network       (auth only, horizontal peek scroll)
─────────────────────────────────────────────
ACT 3 — WHERE TO SHOW UP
  7. Featured Events         (carousel, unchanged)
  8. Upcoming in your groups (auth only)
  9. City Meetups            (unchanged, sits as a quiet strip)
─────────────────────────────────────────────
BLOG — Recent reads          (already the reference style; stays as the closer)
```

Nothing is removed. `HomeLiveWorkshopsRail`, `HomePulseRail`, `YourGroupsStrip`, `CollabsRail`, gallery, `NetworkRail`, `FeaturedEventsCarousel`, `UpcomingInMyGroupsRail`, `CityMeetupsStrip`, `HomeBlogRail` all remain.

## Section-by-section moves

- **Pulse rail** — shrink to a single horizontal ticker row with an eyebrow "LIVE PULSE". Removes the current double-header feel.
- **Lounge (sample tiles)** — keep the mechanic you like (tiles swap out once someone joins). Restyle tiles to match the new card language: cover + eyebrow ("LOUNGE · Music") + big title + "N in room" chip.
- **Collabs** — 3 cards on desktop instead of up to 6. Card mirrors blog card shape; roles become chips inside the body, not on the cover.
- **Gallery** — 3 cards (down from up to 8) using the new editorial card. Category tabs + Newest/Trending pill stay above the grid, but sit on a single line and align with section header. "Browse the full Gallery →" underneath as today.
- **Network rail** — mobile-style peek scroll on all breakpoints; caps at 8. Same card shape, narrower width.
- **Featured Events** — carousel stays, but frame it with the same section header pattern so it stops looking like a different site.
- **Upcoming in your groups** — same peek-scroll pattern as network rail. Uses `EventCard` restyled to the editorial card.
- **City Meetups** — demote to a two-line quiet strip: eyebrow + inline pills for each city. Frees a lot of vertical space and stops competing with Events.
- **Blog** — unchanged; it's the reference.

## Encouraging behavior

- Lounge tiles keep the "join and it swaps" mechanic; add a subtle "join to appear here" microcopy under the section.
- Every card has a single primary affordance (whole card is the link) — no dual buttons.
- Section footer links become pill-shaped `→` links, consistent placement bottom-center.
- Empty states stay opinionated with a CTA (already good), restyled to the new card shape.

## Technical notes

- New shared component `src/components/editorial-card.tsx` — the base card shape (cover + eyebrow + title + dek + optional chips). Wrap or re-skin `WorkCard`, `CollabCard`, `EventCard` variants used on the homepage via a `variant="editorial"` prop so other surfaces (Gallery route, Collab board) are unaffected.
- New `src/components/home-section.tsx` — standard `<section>` wrapper: eyebrow, title, dek, right-side link pill, consistent padding + hairline top border. Refactor `src/routes/index.tsx` to use it for every act.
- Reorder JSX in `src/routes/index.tsx` per the act structure above.
- `HomePulseRail` — reduce to single-line ticker mode (add a `compact` prop).
- `HomeLiveWorkshopsRail` — restyle sample tiles to editorial card; behavior unchanged.
- `CityMeetupsStrip` — collapse to a one-row pill list.
- No DB, no server-function changes. No new dependencies. All work in frontend/presentation.

## Out of scope

- Hero section (untouched per your ask).
- Route-level Gallery / Collab board / Events pages (only the homepage previews change).
- Card styles on non-homepage surfaces.
