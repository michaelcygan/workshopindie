Wave 4 is done. Here is Wave 5.

# Wave 5 — Normalize creative categories

## Audit findings (verified this turn)

There are **two independent taxonomies plus a local duplicate**, and they disagree on labels:

| Source | Values in use | Where |
| --- | --- | --- |
| `category` enum (`src/lib/categories.ts`) | `film`, `music`, `writing`, `writing_book`, `build`, `visual` + 10 discussion/format values (`critique`, `business`, `coworking`, `office_hours`, `roundtable`, `pitch`, `listen_party`, `open_mic`, `jam`, `standup`) | `works.category`, `collab_posts.category`, `profiles.categories`, Gallery filters, Lounge topics |
| `group_category` enum | `music`, `film_video`, `writing`, `visual_art`, `games_tech`, `performance`, `audio`, `scene_life`, `city`, `language` | `groups.category` |
| Hardcoded copy of the group list | same 10 values, its own labels | `src/routes/groups.index.tsx` lines 31–58 — shadows the shared import |

Label drift is real and visible today: the same concept renders as **"Film"** on a Work and **"Film & Video"** on a Group; **"Visual"** vs **"Visual Art"**; **"Build"** vs **"Games & Tech"**.

Production data (counts):
- `works`: music 6, writing_book 3, film 2, build 1
- `collab_posts`: music 3
- `groups`: music 14, city 10, scene_life 9, film_video 7, visual_art 7, games_tech 6, performance 5, writing 5, audio 2, language 1, unset 5
- `profiles.categories`: film 2, build 2, writing 2, music 1, visual 1
- `profiles.mediums`: 11 distinct free-form descriptors (separate `src/lib/mediums.ts` list)
- `group_events.kind` uses `group_event_kind` (open_mic, screening, workshop_irl…), which is an **event format**, not a creative category — out of scope.

So nothing needs re-categorizing; the problem is that one concept has three definitions.

## Approach

Build one canonical taxonomy in code and normalize at the data boundary. **No database changes in this wave** — enum values and stored rows stay exactly as they are, so no existing filter, RLS policy, or write path can break. Enum consolidation and any row backfill are deferred to Wave 9, once every surface reads through the canonical layer.

### Canonical categories

| id | Label | Legacy values that map to it |
| --- | --- | --- |
| `music` | Music | `music` |
| `film_video` | Film & Video | `film`, `film_video` |
| `writing` | Writing | `writing`, `writing_book` (Book becomes a subtype) |
| `visual_art` | Visual Art | `visual`, `visual_art` |
| `games_tech` | Games & Tech | `build`, `games_tech` |
| `performance` | Performance | `performance` |
| `audio` | Audio | `audio` |
| `design` | Design | (new; no stored rows yet) |
| `other` | Other | anything unrecognized |

Community-flavor categories `scene_life`, `city`, and `language` stay first-class but are tagged as community-only, so they keep appearing in Group filters and stay out of Work/Collab pickers. The 10 discussion/format values (`critique`, `coworking`, `open_mic`, …) are reclassified as **topics**, not creative categories — they describe a conversation or gathering, not a medium, and they keep their current labels and colors.

Subtypes stay where they are (`works.subtype`, free text) and are consolidated under the canonical ids, with Book, Essay, Poetry, Screenplay, Song, Album, Score, Photography, Painting, Game, Software, Podcast folded into the existing per-category lists.

## Changes

**1. New `src/lib/taxonomy.ts`** — the single source of truth: canonical ids, labels, color-token classes, subtypes, community/topic flags, plus three helpers:
- `normalizeCategory(value)` — legacy or canonical value in, canonical id out.
- `categoryLabel(value)` / `categoryClassFor(value)` — accept legacy values so no caller has to normalize first.
- `storageValuesFor(canonicalId)` — canonical id out to the stored enum values a query must filter on (`writing` → `['writing','writing_book']`, `games_tech` → `['build']`, `film_video` → `['film']`, `visual_art` → `['visual']`). This is what keeps existing content discoverable under the new labels.

**2. `src/lib/categories.ts` becomes a compatibility layer** re-exporting `CATEGORY_LABELS`, `categoryClass`, `WORK_CATEGORIES` etc. from the taxonomy module, so the ~40 files importing it pick up unified labels without being touched. Its own hardcoded label/color maps are deleted.

**3. `src/routes/groups.index.tsx`** — delete the local `CATEGORY_VALUES` / `CATEGORY_LABELS` duplicate and drive the filter circles, counts, search haystack, and `?c=` param off the shared taxonomy. The `?c=` validator accepts legacy aliases and normalizes them so existing shared links keep working.

**4. Filter call sites use `storageValuesFor`** — Gallery (`src/routes/gallery.tsx`), Collabs (`src/routes/collab.index.tsx`), and the profile Works tabs (`src/routes/u.$username.tsx`) filter with `.in(...)` over the expanded storage values instead of a single equality, so a Writing filter surfaces the 3 `writing_book` works and a Games & Tech filter surfaces the `build` work.

**5. Work display keeps the Book distinction** — a `writing_book` work renders the canonical "Writing" chip plus its subtype; where `subtype` is null the taxonomy supplies "Book" as the derived fallback, so nothing reads as less specific than it does today. No row is rewritten.

**6. Pickers stay storage-safe** — `works.new`, `works.$slug.edit`, `collab.new`, `me.edit`, and `onboarding` show canonical labels but continue writing the existing enum values, so the `category` enum needs no ALTER this wave.

## Database changes

None.

## Acceptance criteria

- One module defines categories; no component or route declares its own list.
- The same concept shows the same label everywhere (Film & Video, Visual Art, Games & Tech).
- Every existing Work, Collab, Group, and profile stays discoverable — Writing includes Book works, Games & Tech includes Build works.
- Legacy `?c=film` / `?c=visual` / `?c=build` URLs still resolve.
- Group filter circles still list all ten group categories with live counts.
- Topics (Open Mic, Critique, Co-working…) are unchanged in Lounge and Events.
- `tsgo` typecheck clean.

## Verification

Typecheck, then a Playwright pass over `/gallery` (each category tab, confirming Writing returns the Book works), `/groups` (each filter circle + a legacy `?c=` URL), `/collab`, a Work detail page, and a profile — checking labels and console errors.

## Risks and rollback

Main risk is a filter that silently returns nothing because a canonical id was passed where a stored enum value was expected; `storageValuesFor` is the single chokepoint for that and the Playwright pass exercises every filter. No migration, so rollback is a code revert.

## Deferred

Enum consolidation (`ALTER TYPE`), backfilling `works.category`/`groups.category` to canonical ids, dropping unused enum members, and adding a `design` option to writable pickers — all to Wave 9, after this layer has been live.
