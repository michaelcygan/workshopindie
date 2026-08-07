# Category taxonomy inventory (Wave 9, step 1)

Verified against the live database and codebase on 2026-08-07. Row counts are
production counts at the time of writing.

`src/lib/taxonomy.ts` is the canonical authority: twelve canonical ids, with
`normalizeCategory` translating legacy stored values at every read boundary.
This file records what is actually stored underneath it.

## Postgres enums

| Enum | Values | Notes |
| --- | --- | --- |
| `category` | film, music, writing, build, visual, critique, business, mentorship, coworking, office_hours, pitch, roundtable, listen_party, open_mic, jam, standup, writing_book, other | Mixes **creative categories** (film, music, writing, build, visual, writing_book) with **topics** (critique, business, coworking, …). Legacy spellings: `film`, `visual`, `build`. |
| `group_category` | music, film_video, writing, visual_art, games_tech, performance, audio, scene_life, city, language | Already the canonical spelling. No migration needed. |

## Columns storing a creative category

| Table.column | Type | Stored values in production |
| --- | --- | --- |
| `works.category` | `category` | music 6, writing_book 3, film 2, build 1 |
| `collab_posts.category` | `category` | music 3 |
| `workshops.category` | `category` | (none set) |
| `workshop_links.category` | `category` | film 1 |
| `instant_rooms.category` | `category` | (all null, 73 rows) |
| `instant_rooms.medium` | `category` | film 5, build 1, business 1, music 1, writing 1 |
| `standing_meetups.default_category` | `category` | (none set) |
| `profiles.categories` | `category[]` | film 3, writing 3, build 2, music 2, visual 2 |
| `groups.category` | `group_category` | canonical already — city 10, music 15, film_video 8, … |

Total rows carrying a legacy spelling: fewer than 40. This migration is small
in data terms; the risk is in read paths, not volume.

## Deliberately out of scope

These look like taxonomy and are not:

- **`profiles.mediums`** (`text[]`) — free-form speciality tags (ceramics, dj,
  photography-analog, songwriting). A personal descriptor, not a filterable
  category. Left alone.
- **`instant_activity.medium`** — typed `category` but only ever holds topics
  (coworking 3, critique 6). Topics are a separate list in `taxonomy.ts` and
  stay separate.
- **`blog_posts.category_slug`** (`text`) — the blog's own editorial taxonomy
  (`general` 114, `games-tech` 1), owned by `src/lib/blog-categories.ts`.
- **Topic values inside the `category` enum** — critique, business, coworking,
  office_hours, pitch, roundtable, listen_party, open_mic, jam, standup,
  mentorship. They stay valid stored values and keep their own labels.
- **`works.subtype`** — free-form sub-classification under a canonical
  category. Unchanged.

## Final stored form

One canonical set, stored as text and constrained by CHECK, alongside the
legacy enum column:

```text
music | film_video | writing | visual_art | games_tech | performance
audio | design | scene_life | city | language | other
```

`writing_book` collapses to `writing` for filtering while keeping its "Book"
display override, exactly as `taxonomy.ts` already does today.

Community-only ids — `city`, `scene_life`, `language` — are valid for Groups
and not for Works or Collabs (`WORK_CANONICAL_IDS` already encodes this).

## Staging

1. Inventory (this file).
2. Add `category_canonical` / `categories_canonical` columns, backfilled and
   kept in sync from the legacy column by trigger. Both agree at all times.
3. Move reads to the canonical column, compatibility mapping still in place.
4. Drop legacy columns and the mixed `category` enum — **a later wave**, once
   nothing reads them.
