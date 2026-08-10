# Field / Format migration — waves 11 to 14

Waves 1–10 are done: one canonical Field vocabulary, canonical storage, the shared Field picker and Format input, and Work, Collab, Blog, Profiles, Groups and Events all authoring on Fields. What remains is the system groups, the read surfaces, the language, and the regression net.

## Wave 11 — System groups follow Fields

Today the auto-linking triggers route new Works, Blog posts and Events into "medium" groups through a legacy mapping, so a Field like Science & Research or Architecture & Cities has nowhere to land.

- Retarget the medium mapping and the auto-link triggers at the canonical Field vocabulary, keeping existing system group slugs stable so no URL breaks.
- A Field with no system group simply doesn't auto-link — no group is auto-created, and nothing errors.
- Re-key the remaining legacy names in the mapping and lock the behaviour with a test that walks every Field.

## Wave 12 — Read and discovery surfaces

- Every place that reads a category — gallery, home rails, profile and group tabs, cards, peeks, search, filters, related rails, share cards, SEO metadata — goes through the one canonical normalization boundary already in `taxonomy.ts`.
- Retire the two competing lists (`src/lib/categories.ts`, `src/lib/mediums.ts`) as taxonomies. Blog's slug list survives only as URL-compatibility data.
- Historical rows still resolve: legacy stored values normalize on read, so nothing drops out of a filter.
- Ranking and ordering logic is untouched.

## Wave 13 — Language pass

- Category → Field, Subtype → Format, Genres → Fields across labels, placeholders, empty states and help text.
- "Games & Tech" and "Build" disappear as user-facing buckets.
- Genuine editorial and admin categories (blog story types, admin groupings) stay categories — this is a vocabulary pass, not a find-and-replace.

## Wave 14 — Regression tests

- Fixtures for interdisciplinary cases: painting, play, short film, software project, AI research, 3D print — plus the existing Music / Film / writing / Visual / build rows.
- Headline assertion: a Field with no legacy enum equivalent survives write → read → edit → write intact, and no historical row disappears from any filter.
- Parity test between the TypeScript vocabulary and the database mapping so the two can't drift.

## Technical notes

- No new tables and no new enum values; new Fields live in canonical text / text[] columns with a legacy enum value written alongside for NOT NULL compatibility.
- Wave 11 is one database migration (function + trigger bodies) plus the mirrored `supabase/generated/taxonomy-functions.sql`.
- `works.subtype` stays physically named and is presented as Format.
- Each wave ends with a typecheck and the full test suite before the next starts.
