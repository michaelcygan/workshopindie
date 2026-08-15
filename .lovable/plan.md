# Gallery taxonomy alignment: Field → Category → Subject → Material

A finishing pass, not a redesign. The approved Gallery Page and Post to Gallery layouts stay exactly as they are; only labels, the authoring controls in the classification block, and the data contract behind them change.

## What is true today (verified)

- The shared layer already exists: `src/lib/work-categories.ts` (Category registry + resolver), `src/lib/work-form.ts` (schema, hydration, write payload), `src/lib/work-card-query.ts` (one select + card mapper), `src/components/work/work-form-fields.tsx`, `src/components/work/work-about-section.tsx`.
- That layer calls the top-level concept **Medium** in labels and identifiers (`MediumCategoryPicker`, `medium`, `mediums[]`, "Pick a Medium.", the `Medium` row in About this Work).
- The shared form model holds a **single** top-level value (`medium: FieldId | ""`), not up to three with a starred primary.
- `works.new.tsx` and `works.$slug.edit.tsx` have **not** been migrated yet — they still render `FieldPicker` + `SubcategoryPicker` + `FormatInput` and write `subtype`/`subcategories` by hand.
- Schema already has `category_id`, `subjects`, `materials`, `details`, `publication_date`; legacy `category`, `categories`, `category_canonical`, `categories_canonical`, `subtype`, `subcategories`, `book_*` all still exist.

No schema change is needed for this pass.

## Language

Rename the public concept from Medium to **Field** everywhere Gallery-facing: Post to Gallery, Edit Work, Gallery Page (`MEDIUM` row → `FIELD`), Gallery filters, card eyebrows, profile rails, Favorites, Following, search copy, the `/gallery` meta description. Internally, identifiers rename too (`medium` → `field`, `mediums[]` → `fields[]`, `MediumCategoryPicker` → `FieldCategoryPicker`) so authoring and public code share one word. Legacy database column names (`category_canonical`, `subtype`) are untouched.

## Authoring block (Post to Gallery and Edit Work, same components)

Order becomes **Field → Category**, then the existing contextual fields (Subject, Material, Publication date, Location, Source, Rights, Credits, Groups, Visibility) unchanged.

- **Field**: keep the current chip picker and its visual design, now multi-select — 1 required, up to 3, one starred primary, General exclusive. Helper: "Choose the broad field this Work belongs to. Add up to three and star one as primary." Existing multi-Field Works keep all their Fields.
- **Category**: the current Format control renamed, one required, suggestions driven by the **primary** Field, custom values allowed, chip interaction preserved. It writes the single canonical Category the Gallery Page reads — no parallel Format value.
- Under Category, a subtle live preview: `Appears in Gallery as: MUSIC VIDEO · FILM & VIDEO`, matching the card eyebrow.
- **Specialization** is removed from both forms. Existing `subcategories` values are read on hydrate and written back unchanged on save; nothing is converted or deleted.
- **Material** stays conditional on the selected Field/Category (already encoded as `material: true` in the registry); hidden for Trailer, Music video, Podcast, Software, Dataset, Research paper and similar.
- **Publication date** keeps its own field with the required helper text, is optional, never derived from `published_at`, and never overwrites an existing Book publication date.

Both routes are migrated onto the shared form model, so Edit Work exposes exactly the same fields as Post to Gallery, prefilled, and saving preserves legacy columns, extra Fields, assets, credits, Groups, relationships and book data.

## Public surfaces

- **Gallery Page / About this Work**: same restrained styling. Rows, only when populated: FIELD (all selected Fields, primary first), CATEGORY, SUBJECT, MATERIAL, PUBLICATION DATE, factual details, LOCATION, SOURCE, LICENSE, then the already-named relationship rows (Related Work, Blog posts, Collabs, Groups, Events, Resources). No "Connections" heading; Groups reflect real Group relationships only.
- **Cards**: eyebrow `CATEGORY · PRIMARY FIELD`; no Format, Specialization or Medium wording. Primary Field is the starred one.
- **Filters**: Field (primary) → Category (scoped to Field) → Subject → More filters (Material, Location, Group). A Work matches on any of its Fields while its card shows the primary. Existing URL search-param behavior is kept.

## Technical notes

- `work-form.ts` gains `fields: FieldId[]` (primary first) replacing `medium`; `buildWorkWritePayload` keeps calling `fieldWritePayload` so `category`, `categories`, `category_canonical`, `categories_canonical` and the `subtype` mirror stay in sync, and now passes through the untouched existing `subcategories`.
- `resolveWorkClassification` returns `{ fields, primaryField, fieldLabel, categoryLabel, source }`; its four fallback tiers (`category_id` → `subtype` → alias in `subcategories` → Field only) are unchanged, so legacy Works keep resolving and rendering.
- `work-card-query.ts` stays the single select/mapper; it already carries `categories_canonical`, so multi-Field filtering needs no new columns.
- Renames are scoped by reading each occurrence — media/asset types, Blog terminology and unrelated `font-medium`-style matches are not touched. Blog taxonomy and Blog authoring are out of scope.

## Verification

Targeted tests plus manual checks for the six acceptance cases (trailer, multi-Field music video, research paper, ceramic Work, legacy Work round-trip, publication date vs. `published_at` with recency still ordered by `published_at`), then typecheck, test suite and production build. Completion report covers every renamed label, how Field/Category are stored and resolved, how legacy Specialization/Format data is preserved, multi-Field behavior, the publication-date separation, and confirmation Blog was untouched.
