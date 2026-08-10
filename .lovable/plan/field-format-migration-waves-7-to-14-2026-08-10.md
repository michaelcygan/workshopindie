# Field / Format migration — waves 7 to 14

Waves 1–6 are done: one canonical Field vocabulary, app-writable canonical storage, the shared Field picker and Format input, and Work + Collab authoring migrated. What follows finishes the job across Blog, Profiles, Groups, Events, the system groups, every read surface, and the language pass.

## Wave 7 — Blog authoring on Fields

- Swap the six hard-coded category chips in the blog "About this post" editor for the shared Field picker (max 3, one primary).
- Persist selected Fields to `blog_posts.fields`, and keep writing a compatible `category_slug` derived from the primary Field so the existing `/blog/c/:slug` URLs, RSS and sitemap keep working. `category_slug` stays inside its current check-constraint list; Fields with no legacy slug fall back to `general`.
- Separate editorial type (Essay, Report, Tutorial, Interview, News, Research Note, Journal) from Field — type answers "what kind of piece", Fields answer "what it's about".
- Reads become Fields-first with `category_slug` as fallback so the 111 imported posts keep their category.
- Acceptance: an Essay tagged Software & AI + Film & Video survives create → edit → publish → public render → filter without collapsing to General.

## Wave 8 — Profiles

- Profile edit and onboarding use the shared Field picker for broad disciplines; the existing `mediums` list stays as the finer "specific practices" layer.
- Writes go to `profiles.categories_canonical`; old stored values keep normalizing on read.
- Profile display, search, filters and the automatic group inputs read canonical Fields.

## Wave 9 — Groups

- User-facing "Genres" becomes "Fields". The internal `kind='genre'` enum value is left alone — no cosmetic migration.
- Admin group create/update can set canonical Fields on `groups.fields`; group pages surface their Field context.

## Wave 10 — Events

- `group_events.creative_category` carries canonical Fields (the column already accepts them after Wave 2). Event kind stays a separate dimension.
- Event create/edit, admin events, the group event directory and seed data all move to the Field vocabulary.

## Wave 11 — System Medium Groups become Field Groups

- Retarget `medium_to_canonical`, `medium_group_id` and the five `tg_*_medium_groups` triggers at the Field vocabulary, so a Field with no legacy system Group is not second-class — without auto-creating a Group per Field.
- Document the decision in code comments and lock it with a test.

## Wave 12 — Read and discovery surfaces

- Gallery, home modules, profile and group tabs, cards, search, filters, related rails, share cards and SEO metadata all filter on canonical Fields through one normalization boundary.
- Retire the competing arrays: `src/lib/categories.ts`, `src/lib/mediums.ts`, and the taxonomy role of `src/lib/blog-categories.ts` (its slug list survives only as URL compatibility data).
- Ranking logic is unchanged.

## Wave 13 — Language pass

- Category → Field, Subtype → Format, Genres → Fields. "Games & Tech" and "Build" retire as user-facing buckets. Genuine editorial/admin categories stay categories.

## Wave 14 — Regression tests

- Fixtures for interdisciplinary cases (painting, play, short film, software project, AI research, 3D print) plus existing Music / Film / writing_book / Visual / build Works, Collab, Profile, Blog post, Group and Event.
- Headline assertion: a Field unsupported by the legacy enum survives write → read → edit → write, and no historical row drops out of any filter.

## Technical notes

- No new tables or enum values; new Fields live in the canonical text / text[] columns with a legacy enum value written alongside for NOT NULL compatibility.
- `works.subtype` stays physically named and is presented as Format.
- Each wave ends with a typecheck plus the taxonomy parity and regression tests before the next starts.
