# Workshop taxonomy — audit and staged implementation plan

## 1. Current-state inventory (verified this turn)

There is already **one** canonical taxonomy module: `src/lib/taxonomy.ts` (567 lines). It owns Field IDs, labels, chip classes, legacy normalization, storage-value mapping, topics, formats, and system-Group slugs. 46 files import it. Supporting modules:

- `src/lib/categories.ts` — documented legacy-enum shim only (re-exports taxonomy).
- `src/lib/work-fields.ts` — read/write helpers that keep legacy enum columns and `*_canonical` columns in sync.
- `src/lib/blog-categories.ts` — Blog editorial slugs (6 only), mapped to canonical Fields.
- `src/components/field-picker.tsx` — the single Field picker (primary + up to 2 extras, star to promote).
- `src/components/category-chip.tsx`, `category-chips.tsx`, `category-scroller.tsx` — display/filter primitives.

The 13 canonical Field IDs in the spec already exist and match exactly (`other`, `music`, `film_video`, `writing`, `visual_art`, `design`, `performance`, `journalism_media`, `software_ai`, `making_engineering`, `science_research`, `architecture_cities`, `environment_nature`). Legacy normalization (`film`, `visual`, `build`, `games_tech`, `writing_book`, `audio`) already exists in `STORAGE_TO_CANONICAL`, and `city` / `scene_life` / `language` are already held apart as community values. Topics (Critique, Open Mic, Jam, …) are already a separate list.

**Conclusion: no second taxonomy needs to be created. This is an extension, not a rebuild.**

## 2. Affected database tables and columns (from live schema)

Already present:

| Table | Field storage | Subcategory storage |
| --- | --- | --- |
| `works` | `category`, `categories`, `category_canonical`, `categories_canonical`, `subtype` | `subcategories text[]` (exists, **unused by app**, 0/12 rows) |
| `collab_posts` | same shape | `subcategories text[]` (exists, unused, 0/4 rows) |
| `workshops` | same shape | `subcategories text[]` (exists, unused) |
| `blog_posts` | `category_slug text` (check constraint, 6 slugs), `fields text[]` (2/118 rows) | none |
| `groups` | `category` enum, `fields text[]` (96/101 rows), `taxonomy_key` | none |
| `group_events` | `creative_category text` + check constraint (15 allowed values) | none |
| `profiles` | `categories`, `categories_canonical`, `mediums text[]`, `tools text[]` | `mediums` is the de-facto specialty list |
| `resources` | `category`, `fields text[]` | none |
| `instant_rooms`, `workshop_links`, `standing_meetups` | legacy enum + `*_canonical` | n/a |

Views to re-check after any change: `public_profiles`, `vw_countable_profiles`.

## 3. Partial work already present

- Canonical Field model, normalization, chips, one picker — done.
- `subcategories text[]` columns on `works` / `collab_posts` / `workshops` were created in an earlier migration but **nothing in the app reads or writes them**, and there is no subcategory vocabulary in TypeScript.
- `blog_posts.fields` (related Fields) exists and is written by the member editor, but the Blog's own section vocabulary is still the old 6 slugs.
- `groups.fields` is populated for 96 groups — must confirm city groups aren't carrying a placeholder Field.

## 4. Conflicts with this specification

1. **Labels differ.** Current: Music, Writing, Visual Art, Making & Engineering, Architecture & Cities, **Other**. Spec: Music & Audio, Writing & Publishing, Visual Art & Photography, Making Craft & Engineering, Architecture & Urbanism, **General**. IDs are unchanged; this is a label-only change with wide visual reach.
2. **`other` is currently a normal, selectable Field alongside others** and is excluded from discovery filters. The spec requires General to be selectable, browsable, and mutually exclusive with other Fields.
3. **No subcategory vocabulary exists** (210 items) and no parent-validation helpers.
4. **Blog has 6 sections, not 13**, enforced by a Postgres check constraint. Adding 13 requires relaxing that constraint before writers change.
5. **`MEDIUM_TO_CANONICAL`** (profile practices) is a small ad-hoc list that overlaps the new subcategory vocabulary; it must become a derived view of subcategories, not a rival list.
6. `FORMAT_SUGGESTIONS` overlaps some subcategory names (e.g. Photograph vs Photography) — formats stay separate by design; no merge.

## 5. Migration ordering that cannot break the homepage

Strict rule: **columns land and are verified before any query selects them.**

1. Migration A (additive only): relax `blog_posts_category_slug_check` to accept all 13 slugs plus legacy `games-tech`; add `blog_posts.subcategories text[] default '{}'`; add `profiles.specialties text[] default '{}'`; add `group_events.subcategory text`; keep every existing column untouched.
2. Apply, then regenerate Supabase types.
3. Only then do server functions and select strings gain the new column names.
4. No column renames, no drops, no data rewrites in this pass. Existing `mediums` stays authoritative until specialties are backfilled in a later, separately approved step.

## 6. File-by-file plan, in waves

**Wave 1 — canonical model (no UI change)**
- `src/lib/taxonomy.ts`: relabel the 13 Fields per spec; add `SUBCATEGORIES` (210 entries, IDs `<field>.<snake_case>`), `subcategoriesForField`, `subcategoryLabel`, `isSubcategoryOf`, `normalizeSubcategory`, and selection validators (dedupe, caps, General-stands-alone, parent match). `other` gains a `general: true` flag so pickers can special-case it.
- `src/lib/taxonomy.test.ts`: mapping, parent, legacy, and cardinality tests.
- `src/lib/blog-categories.ts`: derive all 13 slugs from Fields; keep `games-tech` as a legacy alias resolving to `software_ai`.

**Wave 2 — database prep**: Migration A above, then type regeneration and a homepage smoke check.

**Wave 3 — shared controls**
- New `src/components/subcategory-picker.tsx` (searchable, single-select, hidden for General).
- `src/components/field-picker.tsx`: General exclusivity, clear subcategory on primary change.
- `src/components/category-chip.tsx`: optional subcategory chip variant.

**Wave 4 — Blog pilot**: `src/routes/blog.c.$category.tsx` (13 sections + `?sub=` filter + `games-tech` redirect), `blog.index.tsx`, `me.blog.$id.tsx`, `admin.blog.$id.tsx` / `.new.tsx`, `src/components/blog-editor.tsx`, `blog-about-editor.tsx`, `src/lib/blog-member.server.ts` / `.functions.ts`, `blog.rss[.]xml.ts`, sitemap.

**Wave 5 — Works, Collabs, Profiles**: `works.new.tsx`, `works.$slug.edit.tsx`, `works.$slug.tsx`, `works-quick.server.ts`, `collab.new.tsx` and collab editors, `me.edit.tsx` / `settings.tsx` (specialties grouped by chosen Fields, cap 12), `src/lib/work-fields.ts` (add subcategory to the write payload), gallery and collab-board filters.

**Wave 6 — Groups, Events, Workshops**: `admin.groups.tsx`, group hero/cards (suppress a General chip when a Group has no disciplinary Field), `group-events*.functions.ts` and event admin (optional subcategory only), workshop creation. Location, group kind, event format, and workshop topic stay untouched.

**Wave 7 — secondary outputs**: homepage discovery, internal search, entity pickers, MCP search output, OG/SEO strings, admin reporting.

## 7. QA matrix

| Surface | Logged out | Logged in | Admin | Legacy content |
| --- | --- | --- | --- | --- |
| Homepage | loads, Field chips render | Now board + ticker load | — | old rows show normalized Field |
| Blog index / section pages | all 13 sections resolve; `/blog/c/games-tech` still works | member posts visible | admin editor saves Field + subcategory | 118 existing posts keep their section |
| Works / Gallery | filters by Field and subcategory | create + edit round-trips | — | 12 works with empty `subcategories` render fine |
| Collabs | board filters | create/edit | — | legacy `category` enum rows still listed |
| Groups | city groups show **no** Field chip | join flows | admin can set 0–3 Fields | 96 groups with `fields` unchanged |
| Events | directory filters | RSVP unaffected | subcategory optional | `creative_category` nulls fine |
| Profiles | public taxonomy visible signed-out (`public_profiles`) | up to 3 Fields, 12 specialties | — | `mediums` still displayed until backfill |

Plus: typecheck, existing unit tests, production build, and no query referencing an unapplied column.

## 8. Decisions needing your approval

1. **Relabeling all 13 Fields** (Other → General, Music → Music & Audio, etc.) changes text across the whole product in one pass. Approve as-is?
2. **General becomes browsable and exclusive.** Today `other` is hidden from discovery filters; the spec makes it a real section. Confirm.
3. **Profile specialties**: add a new `profiles.specialties text[]` and keep legacy `mediums` read-only for display, rather than overloading `mediums`. Confirm — the alternative is writing subcategory IDs into `mediums`, which would break the medium-group triggers.
4. **Group chips**: for the 96 groups that currently carry `fields`, should place-based ones be audited and cleared in a later, separately approved data pass? (No data rewrite in this plan.)
