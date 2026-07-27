## Goal
Make the Groups filters reflect real data, and let language-specific groups (e.g. "Creadores en Español") show up under a proper filter.

## Changes

### 1. Add `language` to the group_category enum
Migration: `ALTER TYPE group_category ADD VALUE 'language';`
Then backfill the existing seeded language group(s) so they carry the new value:
- `UPDATE groups SET category = 'language' WHERE slug = 'creadores-en-espanol'` (and any other future language groups by naming convention).

### 2. Dynamic category dropdown on `/groups`
In `src/routes/groups.index.tsx`:
- Compute category options from `allGroups`: `{ id, label, count }` for every category actually present, sorted by count desc, with "All categories (N)" first.
- Hide any category with zero groups (empty list is fine — just "All").
- Add `language` to `CATEGORY_VALUES` and `CATEGORY_LABELS` (label: "Languages") so the enum type stays exhaustive.
- The Zod search schema stays permissive via `fallback`, so a URL param for a category that no longer exists silently falls back to `all`.
- Keep filtering logic as-is; it already keys off `g.category === category`.

### 3. Keep the top "circles" (kind switcher) as-is
Per your answer, languages live in the category dropdown, not the top kind row. No change to `GroupsKindSwitcher`. Language groups will still appear under whatever `kind` they were seeded with (currently `scene`), and users can narrow via the new "Languages" category chip.

## Out of scope
- No changes to `groups-kind-switcher.tsx` circles.
- No new column on `groups`; language identity rides on `category = 'language'`.
- Sort/search unchanged.

## Technical notes
- Postgres won't allow `ALTER TYPE ... ADD VALUE` inside a transaction that then uses the new value — the migration will run the `ALTER TYPE` and the backfill `UPDATE` as separate statements; if the runner wraps them in one tx we'll split into two migrations (enum add first, then the backfill).
- `CATEGORY_VALUES` in the route file is only used for Zod `fallback`, so adding `"language"` is safe and non-breaking.
