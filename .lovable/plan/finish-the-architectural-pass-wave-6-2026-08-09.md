# Finish the architectural pass — Wave 6

Goal: the Blog stops being the one primitive with its own private connection code, and every surface reads and writes connections through the same layer. No user-visible feature changes, no data format changes.

## What changes

### 1. One reference shape for Blog tags
`BlogEntityTag` becomes a thin extension of the shared `WorkshopEntityRef` (same `kind`, `id`, `label`, `sublabel`, `image`, address fields), keeping only the Blog-specific `work` summary used by the "About this post" cards. Persisted rows in `blog_post_entity_tags` are untouched — this is a type and hydration change only.

Effect: chips, peeks, and URLs for a Blog tag come from the same code as everywhere else, so a Work tagged in a post and a Work shown on a Collab page can never render differently again.

### 2. Blog hydration uses the shared visibility predicates
`src/lib/blog-entity-tags.server.ts` currently repeats its own row shapes and visibility filters for works, collabs, groups and events. Those get replaced by the shared ref builders and `@/lib/entities/visibility` predicates already used by `listEntityReferencesServer`. Expected removal of roughly 200 lines of duplicate logic, with the same results.

Blog-specific behaviour that stays exactly as-is: the trusted-author filter, the ranked related-posts query, the owner/admin write paths, and `assertTaggedEntitiesPubliclyVisibleServer` publish guard.

### 3. Blog posts become a reference subject
`listEntityReferencesServer` gains `post` as a subject kind, reading a post's own tags. This lets a Blog post page render the shared "Connected on Workshop" row from the same reader used by Work, Collab, and Event pages, rather than its bespoke query.

The existing rich "About this post" editorial panel stays as the primary presentation on Blog posts — it is a designed surface, not a chip row. It is simply fed by the shared reader.

### 4. Finish surface migration
Add the shared `EntityConnections` row to the Group page (`/g/$slug`) and the Work-side profile surfaces that still hand-roll related queries, matching what Collab and Event pages already do.

### 5. Verification
- Typecheck plus the entity URL guard test.
- Extend `src/lib/blog-entity-tags.server.test.ts` to assert that a private/draft Work tagged in a post is still excluded after the predicate swap.
- Add a reader test for the new `post` subject kind.
- Manual pass in the preview: a published post with mixed tags, a post whose tagged Work was later made private, and the editor picker save/reload round trip.

## Technical notes
- Files touched: `src/lib/blog-entity-tags.ts`, `src/lib/blog-entity-tags.server.ts`, `src/lib/entities/references.server.ts`, `src/lib/entities/references.functions.ts`, `src/components/blog-post-context.tsx`, `src/routes/blog.$slug.tsx`, `src/routes/g.$slug.index.tsx`, plus the tag tests.
- No migrations. No schema or RLS changes.
- `MAX_BLOG_ENTITY_TAGS`, `tagKey`, and `entityMarkdown` keep their current signatures so the editor and quick-create sheet are unaffected.
