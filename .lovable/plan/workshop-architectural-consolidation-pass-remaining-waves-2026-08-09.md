# Workshop — Architectural Consolidation Pass: Remaining Waves

Continuing the original architectural optimization pass. The audit and first three waves are already in place; this plan covers the remaining work to finish the model.

## What is already done

- Wave 1 — URL resolver: `workshopEntityUrl()` is now the single source of truth for entity paths. The guard test in `src/lib/entities/urls.guard.test.ts` prevents hand-templated paths from re-entering.
- Wave 2 — One taxonomy: `src/lib/taxonomy.ts` is the sole author of the creative taxonomy. The database mirror (`canonical_category`, `canonical_from_storage`, `medium_to_canonical`) is generated into `supabase/generated/taxonomy-functions.sql` and verified by `src/lib/taxonomy.sql.test.ts`.
- Wave 3 — Reverse-reference reader (partial): `src/lib/entities/references.server.ts` and `references.functions.ts` provide the one public read, and `src/components/entity/entity-connections.tsx` renders the result. The Work page (`src/routes/works.$slug.tsx`) already uses `<EntityConnections />` to show Collabs, Groups, and Events tied to a Work.

## What remains

### Wave 3 completion — Migrate the Blog page to the shared reader

The Blog post page still uses its own `BlogPostContext` component for its "About this post" panel. Replace the Blog-specific context rail with the shared reverse-reference layer:

- Add a post-aware wrapper (or extend `EntityConnections`) that reads `blog_post_entity_tags` for the current post and renders the tagged entities as chips.
- Keep the existing semantic intent of the panel: it shows what the post is "about" (the entities the author tagged), not every backlink.
- Preserve the current visual placement and heading behavior.
- Delete or demote `src/components/blog-post-context.tsx` once the shared component fully covers it.

### Wave 4 — One reusable connection picker

Extract the picker logic from `src/components/blog-entity-tag-picker.tsx` into a generic `EntityConnectionPicker`:

- Drive it from `src/lib/entities/search.ts` contexts (`editorial` for picking, `conversation` for future messaging use).
- Render each search hit with `EntityReferenceChip` so the same chip appears in the picker and in every surfaced rail.
- Keep the Blog picker's exact current behavior (kinds, tabs, create-a-work prompt) by wrapping the generic component with Blog-specific defaults and the `hitToBlogTag` transform.
- Move the generic picker to `src/components/entity/entity-connection-picker.tsx`.

### Wave 5 — Migrate Collab, Group, and Event related-content sections

Move the remaining entity-detail pages onto the shared reader and picker:

- Collab page (`src/routes/collab.$slug.tsx`): add an "Connected on Workshop" rail showing the Work born from this Collab, Groups it is tagged in, and Events it is showcased at. Replace any hand-rolled related-content queries with `EntityConnections`.
- Group page (`src/routes/g.$slug.index.tsx`): add a rail of recently tagged Works and Collabs (the Group already has Work/Collab tabs; this is a compact, top-level "connected pieces" row that does not duplicate the tabs).
- Event page (`src/routes/g.$slug.e.$eventSlug.tsx`): add a rail of showcased Works and Collabs using `EntityConnections`.
- Where these pages currently surface the same data through bespoke choosers or inline queries, replace them with the shared picker/reader pair and remove the duplicated code.

### Wave 6 — Regression pass

Verify the consolidation did not change visible behavior:

- Run the entity test suites (`urls.guard.test.ts`, `taxonomy.sql.test.ts`, and any existing entity/parse/search tests).
- Walk the affected surfaces in the preview: Blog post, Work detail, Collab detail, Group detail, Event detail. Check signed-in and signed-out states.
- Confirm every chip, link, heading, and filter still resolves to the same URL and renders the same label as before.
- Confirm the Blog composer still opens the same picker, saves the same tag shape, and renders the same "About this post" panel.

## Technical notes

- No new database tables or schema changes are needed for any remaining wave.
- Reads stay in `*.server.ts` / `*.functions.ts`; this pass continues to consolidate duplicates, not add a new data layer.
- Every change is additive-then-delete: the new shared component lands, is verified, and the old duplicate is removed.
- Continue to avoid: a single polymorphic entity table, ORM/repository layer, migration off legacy storage enums, or visual redesign of any surface.
