# Gallery authoring & metadata consolidation

One coherent system for posting, editing, browsing and reading a Work. Gallery-only: the Blog editor, Blog post type and Blog categories are untouched, but the new Subject/Category registry is built as shared utilities so Blog can adopt them later.

## What exists today (verified)

- `works` classification is stored as legacy enum `category`/`categories` plus canonical `category_canonical`/`categories_canonical` (13 Fields in `src/lib/taxonomy.ts`), a free-text `subtype` (Format), and `subcategories[]` (210 specializations).
- `FORMAT_SUGGESTIONS` is a flat string list per Field — no stable IDs, no per-type detail fields.
- Book facts live in dedicated `book_*` columns including `book_published_on`.
- Create (`works.new.tsx`) and edit (`works.$slug.edit.tsx`) are two separate hand-rolled forms with divergent fields; create defaults `field` to `visual_art`.
- Gallery list queries are duplicated in three places: `gallery.tsx` (inline), `src/lib/gallery.functions.ts` (following), plus profile/rail queries — each with its own select string and row→card mapping.
- Assets already use the universal `work_assets` model with an asset-driven viewer. This stays as-is.
- The Gallery Page renders a generic `EntityConnections` block headed "Connected on Workshop".

## Naming

Public labels: **Medium** (canonical Field), **Category** (precise kind), **Subject**, **Material**, **Publication date**, **About this Work**, **Gallery Page**. No "Context", no "Connections" heading, no "Around this Work". Internals keep their existing identifiers where renaming would churn unrelated code.

## Schema (additive only)

New nullable columns on `works`:

- `publication_date date` — the Work's official release date. Never written from `published_at`.
- `category_id text` — stable Category registry ID.
- `subjects text[]` default `{}` — normalized Subject tags.
- `materials text[]` default `{}` — normalized Material tags.
- `details jsonb` default `{}` — Category-driven facts (dimensions + unit, duration, piece count, edition, version, repository).

Indexes: GIN on `subjects`, GIN on `materials`, btree on `category_id`. No RLS change — the columns inherit the existing `works` policies; no new tables, so no new policies. Nothing is dropped or repurposed: `category`, `categories`, `subtype`, `subcategories`, and every `book_*` column stay and keep being written for existing readers.

No destructive backfill. A one-time safe migration only: for rows where `book_published_on` is set and `publication_date` is null, copy it across (`book_published_on` itself is preserved). Everything else stays unset until an owner edits.

## Category registry

New `src/lib/work-categories.ts`: an array of entries with `id`, `label`, `mediums[]`, `aliases[]` (legacy `subtype` strings and high-confidence subcategory IDs), `detailFields[]`, `suggestedAssetTypes[]`, `showMaterial`. Seeded from `FORMAT_SUGGESTIONS` and expanded (Trailer, Painting, Painting Series, Ceramic Vessel, Script, Album, Podcast, Dataset, Repository, Book, …). A Category may appear under several Mediums.

Resolver `resolveWorkClassification(row)` returns `{ medium, category, source }` in this order: `category_id` → `subtype` match → high-confidence `subcategories` alias → Medium-only fallback. Legacy Work never disappears; the edit form shows a non-blocking "finish classifying this Work" prompt when `source !== "category_id"`.

Date helpers: `officialDate(work)` (publication_date, else `book_published_on`) and a display rule that labels `published_at` as "Posted to Workshop".

## Shared create/edit architecture

New `src/lib/work-form.ts` — one Zod schema + defaults + row→form hydration + form→DB payload builder (wrapping `fieldWritePayload` so legacy columns keep syncing and `subtype` keeps mirroring the Category label). New `src/components/work/work-form-fields.tsx` holds the field components: identity (title, Medium, Category), details (short/full description, Publication date, Subject, conditional Material, conditional facts, source URL), people (credits, co-creators, Groups), publishing (license, visibility).

`works.new.tsx` and `works.$slug.edit.tsx` both render these, differing only in the asset composer mode (staged vs persisted) and the submit action. Edit is fully prefilled and can change everything creation can, including asset order, primary asset, captions, alt text and per-asset downloads.

The old Subcategory control is removed from Gallery authoring; existing values are preserved on save.

## Post to Gallery flow

Progressive disclosure in the existing single-page flow: Identity → Presentation (assets, primary, derived cover + override, focal crop, captions/alt, reorder, downloads) → Details → People & context → Publishing. Optional groups stay collapsed.

Medium no longer defaults to Visual Art — it must be chosen, or confirmed after a URL import. Publish requires title, Medium, Category, rights confirmation, and at least one presentation path (asset, cover, media/source link, or substantive description). The existing draft-first upload pipeline is unchanged.

## Gallery Page

Order: `CATEGORY · MEDIUM` eyebrow → title → short description → byline → viewer → actions → description → **About this Work** → credits (if not already shown) → comments.

"About this Work" renders only populated rows: Medium, Category, Publication date, Subject, Material, facts, Location, Source, License, then named relationship rows — Related Work, Blog posts, Collabs, Groups, Events, Resources — sourced from the existing `listEntityReferences` data, split by kind instead of one chip soup. `EntityConnections` stays for other entity types; the Work page gets the named-row presentation. Relationship editing remains limited to what the author is already authorized to create.

## Cards, filters, search

One shared resolver + one shared select/mapping module (`src/lib/work-card-query.ts`) used by Gallery, Following, Favorites, profiles and rails, so metadata cannot drift. Cards show cover (primary asset or override), `CATEGORY · MEDIUM`, title, byline, short description where the format allows, and at most one Subject cue. Legacy category chips and "Portfolio"-style source labels are dropped from public cards; Material is not shown on compact cards.

Filters: Medium (primary) → Category (Medium-aware) → Subject; "More filters" holds Material, City, Group. All filter state is URL search params via the existing `validateSearch` schema, so refresh and back/forward preserve it. Search covers title, short description, description, Medium, Category, Subject, Material and creator. Public browsing and filter counts include only `visibility = 'public'`; unlisted Work stays reachable by direct link.

## Tests and verification

Targeted tests for: classification resolution across all four fallback tiers; `publication_date` never being populated from `published_at` and recency ordering still using `published_at`; the `book_published_on` mirror; visibility filtering (unlisted excluded from browse); Subject/Material normalization. Existing test, typecheck and build commands run before completion.

## Out of scope

Blog editor, Blog post type, Blog categories, and any redesign outside the Gallery surfaces listed above.
