# Logged-out Groups page — bring it up to Events/Blog quality on mobile

## What's wrong today

On a phone, `/groups` signed out reads as a plain stack: a large hero, then a heading, then one enormous featured card that eats the whole screen before anything else appears. The card's cover panel is a full 16:10 block, so a visitor scrolls two screens and has still only seen one Group. Nothing communicates scale, activity, or where to start — unlike Events (compact masthead, live counter chip, filter cluster, dense rows) and Blog (tight masthead, category nav, editorial lead + dense list).

## The fix

Rebuild the logged-out Groups home to follow the same editorial rhythm the other public pages use.

**Compact masthead** — same proportions as the Blog masthead: small "Workshop Groups" kicker, headline at mobile size (not the current oversized one), a two-line deck, and a live meta row underneath: a counter chip ("N scenes · M cities") plus a "Browse all" action. Cuts roughly a screen of vertical space before content starts.

**Lead scene, then a rail** — one editorial lead card (the top featured Group) with the image treatment it has now, followed by the remaining featured scenes as a horizontally swipeable rail of compact cards instead of a vertical stack of giant ones. On desktop the rail becomes the existing grid, unchanged.

**Compact card for mobile** — a shorter card variant: 16:9 cover at reduced height, name and tagline on two lines, member count and kind badge in one row, Join pinned to the corner. Card stays fully clickable (existing stretched-link pattern preserved).

**Activity, cities, mediums** — keep the activity ticker but move it directly under the lead so the page shows life early. Cities and mediums stay as chip rows but get horizontal scroll rather than wrapping into a tall block.

**Directory** — the full directory keeps its current behavior; on mobile its rows get the denser list treatment already used on Events so it doesn't restate the featured cards.

**Sign-up CTA** — moves to just above the directory, sized like the Blog page's inline promos rather than a full-width panel.

No changes to data, queries, filters, join behavior, or the signed-in Groups home.

## Technical notes

- `src/components/groups/public-groups-home.tsx`: restructure sections and ordering; add the meta row with derived counts from `useAllPublicGroups()` (no new queries).
- New `src/components/groups/group-compact-card.tsx` for the rail/dense variant, reusing `GroupCardActions` and the stretched-link + `has-[a:focus-visible]` pattern from `group-featured-card.tsx`.
- Rails use the same horizontal scroll utilities already used by `joined-groups-rail.tsx`.
- Existing design tokens only — Archivo/Inter, monochrome surfaces, cobalt signal; no new colors.
- Head metadata on `/groups` stays as-is.
