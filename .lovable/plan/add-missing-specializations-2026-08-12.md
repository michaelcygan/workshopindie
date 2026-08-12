# Add missing specializations

Add "Trailer" plus a short list of other obvious gaps to the specialization vocabulary (the searchable list under each Field).

## Additions (7)

Film & Video
- **Trailers & Promos** — every film and short has one; currently nothing covers it.
- **Visualizers** — standard release format for music now, and not covered by "Music Videos".
- **Color Grading** — a distinct craft and hire; "Editing & Post-production" hides it.
- **Live Visuals & VJing** — big in the scenes Workshop serves; no home today.

Performance
- **Voice Acting** — sits outside "Acting" in practice (animation, games, audio drama, ads).

Visual Art
- **Tattoo Art** — a major independent practice with no current match.

Music
- **Remixing & Sampling** — distinct from "Music Production" and very common.

Considered and skipped as already covered: Beatmaking (Music Production), Graffiti (Street Art), Screen Printing (Printmaking), Essays (Creative Nonfiction), Motion Graphics (Motion Design), Podcast editing (Podcasting & Radio).

## Technical notes

- Append the labels to the relevant arrays in `src/lib/taxonomy-subcategories.ts`. IDs derive from labels automatically (`film_video.trailers_promos`, etc.), so no id authoring.
- The list is append-only — existing labels stay untouched so saved subcategories keep resolving.
- Update the count assertion in `src/lib/taxonomy.subcategories.test.ts` from 210 to 217.
- No database change: subcategories are validated in TypeScript; only Field canonicals are mirrored into SQL, and no new Fields are added.
