# Wave 5 — Topics for Collabs, Groups, Events, and Resources

Extend the canonical Topic system (already live for Works and Blog) to the remaining primitives, so every entity is tagged from the same picker and filterable by the same slugs.

## What gets built

### Collabs
- Topic picker in the Collab create form and the Collab edit form, sitting under the category/subcategory block (max 5 topics).
- Topics saved to the existing `collab_post_topics` join table through the shared `setEntityTopics` server function.
- Collab detail page shows topic chips linking to the topic hub.
- `/collab` topic filter switches from "slugs found on the loaded page" to the canonical topic list, so it stays correct as the feed paginates.

### Groups
- Steward/admin group editing gains a topic picker (max 5), persisted to `group_topics`.
- Group page shows topic chips.
- `/groups` FilterHeader gains a Topic pill, filtering groups by canonical slug.

### Events
- Event authoring (admin event form and group event creation) gains a topic picker, persisted to `group_event_topics`.
- Event page shows topic chips.
- Topic filter pill added to `/events` and to the in-group event directory, matching the existing FilterHeader pattern.

### Resources
- New `resource_topics` join table (no equivalent exists today), with grants, RLS, and public read.
- Topic picker in the admin resource editor; topic chips on the group Resources tab.

### Topic hub completion
- The `/topics/$slug` hub already queries Works, Events, Collabs, and Groups; add Resources to the hub and make counts reflect the newly tagged entities.

## Technical notes
- No new picker component: reuse `@/components/topics/topic-picker` and `setEntityTopics` from `src/lib/topics.functions.ts`, extending its entity-kind union with `collab`, `group`, `event`, and `resource`, mapped in `setEntityTopicIdsServer`.
- One migration: create `public.resource_topics` (resource_id, topic_id, created_at) with `GRANT SELECT TO anon, authenticated`, `GRANT ALL TO service_role`, RLS enabled, public read policy, and admin-only write.
- Filter reads use the existing pattern in `gallery.tsx`: resolve slug → topic id → entity ids, then narrow the feed query.
- Legacy free-text category/subcategory fields stay in place and untouched; topics are additive.

## Out of scope
- Wave 6 governance tools (merge/alias admin UI) and the legacy free-text backfill.
