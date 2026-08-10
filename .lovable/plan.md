# Complete the Field / Format migration

One shared **Field** vocabulary across all six primitives, **Format** replacing "subtype" in language, and the existing Work asset layer left untouched.

## What the audit found

- `src/lib/taxonomy.ts` is already the single author of the canonical vocabulary and already renders the Postgres mirror (`src/lib/taxonomy.sql.ts` → `supabase/generated/taxonomy-functions.sql`, guarded by a test). This is the right foundation — Wave 1 extends it rather than replacing it.
- Canonical storage already exists for three primitives: `works.category_canonical` + `works.categories_canonical`, the same pair on `collab_posts`, and `profiles.categories_canonical`.
- **Blocking issue:** those canonical columns are entirely trigger-derived from the legacy enum (`tg_sync_canonical_category`, `tg_sync_canonical_category_array`, BEFORE INSERT/UPDATE). Anything the app writes into them today is overwritten. A new Field such as `software_ai` cannot survive a write with the current triggers — this is exactly the regression the request calls out, and it is Wave 2's core fix.
- `works.category` and `collab_posts.category` are **NOT NULL** enum columns, so new Fields still need a legacy fallback value written alongside the canonical Field (compatibility only, never shown to users).
- Missing canonical Field storage: `blog_posts` (only `category_slug text`, six hard-coded slugs) and `groups` (`category` enum + `taxonomy_key text`). `group_events.creative_category` is already `text` holding medium-group keys — it can accept new Fields once its check/consumers are updated.
- Automation keyed to the five legacy medium groups: `tg_works_medium_groups`, `tg_collab_medium_groups`, `tg_profiles_medium_groups`, `tg_blog_medium_groups`, `tg_event_medium_groups`, plus `medium_group_id`, `ensure_medium_membership`, `canonical_from_storage`, `medium_to_canonical`, and `MEDIUM_GROUPS` / `MEDIUM_GROUP_KEYS` in `src/lib/medium-groups.ts`.
- Competing taxonomy arrays to retire: `src/lib/categories.ts` (`WORK_CATEGORIES`, `WORK_SUBTYPES`, `COLLAB_CATEGORIES`), `src/lib/blog-categories.ts` (six slugs), `src/lib/mediums.ts` (`WORK_MEDIUMS`), plus consumers in `gallery.tsx`, `collab.index.tsx`, `collab.new.tsx`, `me.edit.tsx`, `quick-create-work-sheet.tsx`, `blog-about-editor.tsx`, `blog-editor.tsx`, `blog-category-nav.tsx`, `blog.c.$category.tsx`, `admin.events.tsx`, `group-event-directory.tsx`, seed data modules, sitemap and RSS.

## Waves

**Wave 1 — Canonical Field foundation.** Extend `taxonomy.ts` with the 13 target Fields (Music, Film & Video, Writing, Visual Art, Design, Performance, Journalism & Media, Software & AI, Making & Engineering, Science & Research, Architecture & Cities, Environment & Nature, Other) as `FieldId` / `FIELD_OPTIONS` / `fieldLabel` / `fieldClass` / `normalizeField` / `legacyCategoryToField` / `fieldsForStoredValues`. Legacy aliases: `build`/`games_tech`/`code` → Software & AI, `film`/`film_video` → Film & Video, `visual` → Visual Art, `writing_book` → Writing (+ Book format). Add a `fieldToLegacyEnum()` compatibility adapter for the NOT NULL enum columns, clearly labelled as compat code. Regenerate the SQL mirror and update the parity test. No visible change.

**Wave 2 — Canonical Field storage.** Migration that makes canonical columns app-writable: the sync triggers become fill-only (derive from legacy just when the app did not supply a canonical value), so `software_ai` survives write → read → edit → write. Add the smallest additive canonical storage where it is missing: `blog_posts.fields text[]`, `groups.fields text[]` (alongside `taxonomy_key`), and widen `group_events.creative_category` acceptance. Reads become canonical-first with legacy normalization as fallback; backfill existing rows from legacy values. Nothing destructive, no enum changes, no URL changes.

**Wave 3 — One shared Field picker.** `<FieldMultiPicker />` (max 3, one primary, current chip UI, no modal) replacing the taxonomy role of `CategoryMultiPicker`. Plus a `<FormatField />` combobox driven by Field-aware suggestions with freeform fallback.

**Wave 4 — Work create + edit.** Both surfaces move to Fields + Format on the shared components, writing canonical Fields plus the legacy compat enum value. Everything else in the flow (rights, links, groups, co-creators, book details, limits, paste-a-link, assets) is preserved as-is.

**Wave 5 — Quick create Work.** The blog-side quick creator consumes the same Field/Format model — title, Field, Format, optional link, rights — and stops importing `WORK_CATEGORIES` / `WORK_SUBTYPES`.

**Wave 6 — Blog.** Split editorial type (Essay, Report, Tutorial, Interview, News, Research Note, Journal) from Fields. Blog posts gain Fields; `category_slug` is kept populated for old posts, existing `/blog/c/:category` URLs, RSS and sitemap. Derived Work values are relabelled "Formats", never "Mediums". Acceptance case: an Essay with Fields Software & AI + Film & Video round-trips through create → edit → publish → public render → filtering without collapsing to General.

**Wave 7 — Collab create + edit.** Shared Fields; Field-aware role *suggestions* with freeform always available; Fields editable after creation. No new fields in the flow.

**Wave 8 — Profiles.** Fields as broad disciplines, existing `mediums` reused as the specific practices layer. Covers profile edit, onboarding, display, search, filters and the automatic group inputs. Old profile categories keep normalizing.

**Wave 9 — Groups.** User-facing "Genres" → "Fields"; the internal `kind='genre'` enum value stays (no cosmetic migration). Admin group create/update can set canonical Fields; group pages surface their Field context.

**Wave 10 — Events.** `creative_category` carries canonical Fields; Event kind stays a separate dimension. Filters, directory, admin and seed data updated. No feature changes.

**Wave 11 — System Medium Groups → Field Groups.** Retarget `medium_to_canonical`, `medium_group_id` and the five `tg_*_medium_groups` triggers at the Field vocabulary so a Field without a legacy system Group is not second-class — without auto-creating a Group per Field. The decision is documented in code comments and locked by a test.

**Wave 12 — Read / discovery surfaces.** Gallery, home modules, profile and group tabs, cards, search, filters, related rails, share cards and SEO metadata all filter on canonical Fields through one normalization boundary. Ranking logic unchanged.

**Wave 13 — Language cleanup.** Semantic renames only: Category → Field, Subtype → Format, Genres → Fields, Games & Tech and Build retired as user-facing buckets. Genuine editorial/admin categories stay categories.

**Wave 14 — Legacy + regression tests.** Fixtures for the six new interdisciplinary cases (painting, play, short film, software project, AI research, 3D print) plus existing Music / Film / writing_book / Visual / build Works, Collab, Profile, Blog post, Group and Event. The headline assertion: a Field unsupported by the legacy enum survives a full write → read → edit → write cycle, and no historical row drops out of any filter.

## Technical notes

- No new primitives, no polymorphic relationship table, no graph layer, no changes to `work_assets` / `WorkViewer` / asset RLS.
- `works.subtype` is kept physically and presented as **Format** — no risky column rename.
- Legacy enums are never expanded; new Fields live in the canonical text/text[] columns with a compat enum value written for old code paths.
- Each wave ends with typecheck plus the taxonomy parity and regression tests before the next begins.
