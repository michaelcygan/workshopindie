# Groups page: remove hero banner, reclaim space

## 1. Remove the gradient banner (`src/components/group/group-hero.tsx`)
- Delete the `h-16 md:h-20` hero band + fade overlay entirely.
- Keep the avatar tile, name, kind/Official/Featured chips, member count, tagline, and the right-side action cluster (Lounge / Share / Join).
- Drop the negative offsets (`-mt-5` on avatar, `-mt-1` on title block) that only existed to overlap the banner. Identity row sits directly under the top nav on a plain background.
- Tighten vertical padding on the identity row (e.g. `py-3 md:py-4`) so the block reads as a compact header rather than a hero.

Net effect: ~80–96px of vertical space reclaimed above the fold on desktop, ~64px on mobile — the Today board and sidebar move up correspondingly.

## 2. Downstream space wins enabled by the shorter header
- **Tab bar:** collapse the divider gap above tabs; the tabs become the first visual anchor.
- **Today tab (`group-today-tab.tsx`):** with the header shorter, bump the chat scroller clamp from `h-[clamp(240px,36vh,380px)] xl:h-[46vh]` to `h-[clamp(280px,44vh,460px)] xl:h-[54vh]` so more messages are visible without the composer falling below the fold.
- **Right sidebar (Next event / Recent collabs):** tighten card padding from `p-4` to `p-3` and reduce empty-state skeleton row heights so both modules fit above the fold on a laptop instead of pushing "Recent Works" below.

## 3. Not changed
- Avatar, name, chips, tagline, and action buttons stay exactly as they are.
- No changes to tab labels, order, counts, or any data queries.
- Cover image support remains in the schema; this only removes the always-on gradient fallback (a group with `cover_url` also loses its banner on this page for consistency — cover images still appear elsewhere if used).

## Open question
Do you want the cover image (`group.cover_url`) removed from this header too (as above), or kept as a slim 48px strip only when the group has uploaded a real cover? Default plan: remove it here for full consistency.
