# Groups masthead + "Where you belong" composition

Scope: only the signed-in `/groups` landing header and the joined-Groups module row. No changes to data queries, ordering, membership, routes, other `/groups` modules, or individual Group pages.

## What's wrong now

The joined-Groups row is `grid ... lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch` with an auto-sized row. `h-full` / `flex-1` inside an auto row can't cap anything, so the "All groups" panel's full list height sets the row height. The rail ends early, the sidebar runs long, the last tile is clipped by the panel, and everything below is pushed down.

## Masthead (`member-groups-home.tsx`)

- Eyebrow becomes "Groups".
- One layout system: a single flex column, with the title row as `flex items-center justify-between gap-4` from `sm` up — "Your scenes" left, Explore right on the same line; description sits directly under the title, full width.
- Explore stays a quiet secondary utility: smaller text, muted ink, border/hover only — not a filled CTA.
- Rhythm: `py-8` (32px) above, ~20–24px between masthead content and the divider, ~24px between the divider and "Where you belong" (replaces `mt-8` on the section).

## Module row (`joined-groups-rail.tsx`)

- Desktop grid: `lg:grid-cols-[minmax(0,1fr)_280px]`, `gap-4`, and an explicit shared height `lg:h-[180px]` with `lg:items-stretch`. Below `lg` the height constraint is absent and the current swipeable rail behavior is untouched.

Left rail:
- `h-full min-w-0`, horizontal scroll only, tiles `h-full` so they fill the 180px row.
- Tile internals recomposed to fit 180px: image block flexes, name/kind/member line stays pinned at the bottom. Same content, same compact image-led look.
- Remove `hover:-translate-y-0.5` (clips inside the constrained row); keep hover as border/underline plus a soft shadow.
- Add a subtle right-edge fade over the rail (pointer-events-none gradient, desktop only) as the overflow cue. Trackpad and keyboard scrolling untouched.

Right "All groups" panel:
- Same `lg:h-[180px]`, `overflow-hidden`, rounded/border matching the tiles, `flex flex-col`.
- Label `flex-none`, never scrolls.
- List body `flex-1 min-h-0 overflow-y-auto overscroll-contain` with a thin quiet scrollbar; every joined Group stays in the list, names truncate.

## Verification

Playwright screenshots of the masthead + module row at 1280px and 1440px, plus a 1024px and 2048px check for edge alignment (top and bottom flush within a pixel), internal scrolling with 8+ groups, no clipped tile, and no page-level horizontal scrollbar. Mobile/tablet spot check to confirm unchanged.
