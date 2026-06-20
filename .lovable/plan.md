# Homepage cleanup — branded module titles + Workshops visibility

Goal: the homepage reads as four clear modules — **Workshops**, **Collabs**, **Works**, **Events** — and Workshops is always present (with an empty state) even when no live rooms exist.

## 1. Rename module headings to branded one-word titles

| File | Current heading | New heading |
| --- | --- | --- |
| `src/components/home-live-workshops-rail.tsx` | "Live Workshops" | **Workshops** |
| `src/routes/index.tsx` (CollabsRail) | "Open Collab calls" | **Collabs** |
| `src/routes/index.tsx` (gallery section) | "Works Gallery" | **Works** |
| `src/components/featured-events-carousel.tsx` | "Featured events" | **Events** |
| `src/components/upcoming-in-my-groups-rail.tsx` | "Upcoming in your groups" | keep as sub-rail (smaller header, secondary) — not one of the four primary modules |

Subcopy under each heading stays (or gets a light refresh) so the one-word title still has context, e.g.:
- Workshops — "Live rooms with seats open. Walk right in."
- Collabs — "People building stuff now. Help out — or post your own."
- Works — "Finished things people made together."
- Events — "What's happening across the network."

All four use the same heading scale (`font-display text-3xl md:text-4xl`) for visual parity.

## 2. Workshops module: always visible, with empty state

`HomeLiveWorkshopsRail` currently returns `null` when there are no qualifying rooms — that's why the user doesn't see Workshops on the homepage right now.

Change behavior:
- Always render the section + heading.
- When `data` is empty, render an empty-state card matching the Collabs empty-state styling (dashed border, centered, primary CTA):
  - Title: "No live Workshops right now."
  - Sub: "Start one — five seats, shared tools, anyone can drop in."
  - Primary CTA: "Start a Workshop" → `/workshop`
  - Secondary link: "Browse scheduled →" → `/workshops`

## 3. Spacing / layout parity

Make the four primary modules share consistent vertical rhythm on the homepage so they read as siblings:
- `pt-10 md:pt-14` top padding on each primary module section
- `pb-10 md:pb-14` bottom padding
- Same `max-w-7xl px-4 md:px-6` container

Apply to: Workshops rail section, CollabsRail, Works gallery section, Events (FeaturedEventsCarousel wrapper).

## Out of scope

- No backend / data changes.
- No changes to card components, routing, or the Hero.
- Internal identifiers, file names, query keys untouched — copy + layout only.

## Files touched

- `src/components/home-live-workshops-rail.tsx` — heading rename, render-always + empty state
- `src/components/featured-events-carousel.tsx` — heading rename + size bump
- `src/routes/index.tsx` — CollabsRail + Works gallery heading rename, section padding parity, wrapper around FeaturedEventsCarousel
