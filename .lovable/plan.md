# Workshop — Architectural Consolidation Pass

An optimization of what already exists. No rewrite, no new database objects for their own sake, no speculative abstraction layer.

## What the audit found

**Already strong — preserve as-is:**

- The six primitives are real and distinct in the database (`profiles`, `works`, `blog_posts`, `collab_posts`, `groups`, `group_events`). Nothing needs merging.
- `src/lib/entities/kinds.ts` is already the canonical vocabulary: one `WorkshopEntityKind` union covering exactly the six primitives, one `workshopEntityUrl()` resolver, one `WorkshopEntityRef` shape, one `entityMarkdown()` writer.
- `src/lib/entities/visibility.ts` is the single "may this be referenced publicly" authority, and it delegates to domain helpers rather than redefining them.
- `src/lib/entities/parse.ts` is the single body tokenizer for Today, Lounge and DMs, with tests.
- `src/lib/entities/search.ts` is already context-aware (`conversation` vs `editorial`) — the interdisciplinary search idea is largely built.
- Taxonomy is already two-layer: legacy Postgres enums for storage, canonical ids for display and filtering, normalized in `src/lib/taxonomy.ts` and mirrored in the database by `canonical_category()` / `canonical_from_storage()` / `medium_to_canonical()`. The `*_canonical` columns are `text`, not enums, so expanding the canonical set is additive and safe.
- Relationships already live in their own semantic tables (`blog_post_entity_tags`, `group_works`, `group_collabs`, `work_credits`, `relationship_edges`, `group_members`) rather than in one polymorphic soup. Keep it that way.

**Where the model is incomplete:**

1. **URL templating still bypasses the resolver.** Only 4 files import `workshopEntityUrl`. Roughly 30 files template entity paths by hand (`/works/${slug}`, `/g/${slug}/e/${slug}`, `/blog/${slug}`). This is the single largest source of future drift.
2. **Taxonomy has two disagreeing sources.** `src/lib/taxonomy.ts` and the database `canonical_category()` maintain the same mapping table by hand; `design` exists in TypeScript but is absent from `canonical_from_storage()` and from `group_category`. `medium_to_canonical()` holds a third list of finer-grained mediums (photography, DJ, poetry, comics) that TypeScript does not know about.
3. **Reverse context is one-off per surface.** `entity-blog-posts.tsx` answers "what posts point at this?" only for the Blog→Work direction. Work, Collab, Group and Event pages each hand-roll their own related-content queries.
4. **Connection UI is not standardized.** `blog-entity-tag-picker.tsx` is the only full picker; other surfaces use bespoke choosers even though `search.ts` can already serve them.

## Plan in waves

Each wave ships independently and is safe to stop after.

### Wave 1 — Finish the URL resolver (mechanical, zero behavior change)
Replace hand-templated entity paths with `workshopEntityUrl()` / typed `<Link to params>` across the ~30 call sites. Add a lint-style test asserting no source file outside `kinds.ts` templates a bare entity path. Nothing else changes.

### Wave 2 — One taxonomy, generated
Make `src/lib/taxonomy.ts` the sole author of the mapping and generate the SQL functions from it. Add the finer mediums the database already knows (photography, DJ, poetry, comics, animation, game design) to the TypeScript canonical/medium tables so search, filters and chips see the same vocabulary the medium-group triggers use. Fill the `design` gap. A test asserts the TypeScript map and the deployed SQL function agree for every value.

### Wave 3 — A single reverse-reference read
Generalize `entity-blog-posts` into one query helper: "given an entity ref, return the other primitives that point at it," backed by the relationship tables that already exist. Migrate the Work page and Blog page onto it first; leave the other surfaces on their current queries until Wave 5.

### Wave 4 — One connection picker
Extract the picker inside `blog-entity-tag-picker.tsx` into a reusable `EntityConnectionPicker` driven by `search.ts` contexts, rendering `EntityReferenceChip`. Blog keeps its exact current behavior; the component simply becomes reusable.

### Wave 5 — Migrate the remaining surfaces
Move Collab, Group and Event related-content sections onto the Wave 3 reader and the Wave 4 picker, deleting the per-page duplicates. Verify against the current rendering before removing anything.

### Wave 6 — Regression pass
Run the existing entity test suites, walk Blog, Work, Collab, Group, Event, Today, DMs and Profile in the preview signed-in and signed-out, and confirm no link, chip or filter changed.

## Technical notes

- No schema changes are required for Waves 1, 3, 4, 5. Wave 2 touches only `IMMUTABLE` mapping functions plus an additive `design` value; no stored rows are rewritten.
- `writing_book` keeps its "Book" display override; the canonical bucket stays `writing`.
- Reads stay where they are (`*.server.ts` / `*.functions.ts`); this pass consolidates duplicates, it does not introduce a new data layer.
- Every wave is additive-then-delete: the new path lands and is verified before the old one is removed.

## Explicitly not doing

- No single polymorphic `entities` or `relationships` table.
- No merging of primitives, no ORM layer, no repository pattern.
- No migration off the legacy storage enums.
- No visual redesign of any surface.
