## Group page: space + reliability pass

Three focused fixes on `/g/$slug` — no redesign, just squeezing wasted space and correcting the Recent Collabs query so the module never lies.

### 1. Reclaim header space above the news ticker

Currently `GroupHero` uses `py-3 md:py-4` and its parent stack uses `space-y-4`, producing ~28–32px of dead space between the identity row and the "IN THE NEWS" ticker (the small circle in the screenshot).

- In `src/routes/g.$slug.tsx`: change the wrapper `<div className="space-y-4">` around the hero + ticker + tab bar to `space-y-2` so the ticker sits closer to the identity row. Tab bar keeps its own breathing room via its section padding.
- In `src/components/group/group-hero.tsx`: tighten identity row padding to `px-4 py-2 md:px-6 md:py-2.5` (was `py-3 md:py-4`). Also drop the tagline's `mt-0.5` → `mt-0` (already tight).

Result: ~20–24px reclaimed above the fold, ticker reads as part of the header.

### 2. Shorten the Today chat so the composer stays above the fold on laptops

`group-today-tab.tsx` line 199 currently clamps to `h-[clamp(280px,44vh,460px)] xl:h-[54vh]`. On the reported ~735px viewport, 44vh ≈ 323px plus header (~130px) + ticker (~40px) + tab bar (~48px) + composer (~64px) pushes past the fold.

- Change the scroller clamp to `h-[clamp(240px,34vh,380px)] xl:h-[46vh]`.
- Keep the outer flex column so pinned messages still consume internal space (no container growth).

### 3. Fix Recent Collabs so it populates whenever collabs exist

Bug is in `RecentCollabs` inside `src/components/group/group-today-tab.tsx` (~L381–401). The query pulls the 12 most recent `group_collabs` rows, then client-filters `c.status === "open"`. Any recent collabs that are `full`, `closed`, `wrapped`, etc. get dropped, and — worse — if the 12 most recent all happen to be non-open the module reads "No open collabs yet" even though the Collabs tab shows 3.

Rule the user stated: **if any collabs are posted into the group, Recent Collabs must never be blank.**

Fix:
- Remove the `status === "open"` client filter entirely. Show the 5 most-recently-added collabs regardless of status.
- Rename the empty-state copy to `"No collabs yet."` (only shown when the group truly has zero collabs).
- Surface status subtly on each row: append a tiny status pill next to the category pill when status is not `open` (e.g. `Full`, `Closed`, `Wrapped`) so users still see state at a glance. Uses existing muted pill styling — no new tokens.
- Keep `limit(12)` → `.slice(0, 5)` so we still de-dupe/order client-side without an extra RPC.

No schema, RLS, or server-fn changes.

### Technical details

- Files touched:
  - `src/routes/g.$slug.tsx` (spacing wrapper)
  - `src/components/group/group-hero.tsx` (identity row padding)
  - `src/components/group/group-today-tab.tsx` (chat clamp + RecentCollabs query & row rendering)
- No migrations, no new deps.
- Verify by reloading `/g/chicago` on a 1280×735 viewport: composer visible without scroll, Recent Collabs lists the 3 existing Chicago collabs, header sits tight against the news ticker.
