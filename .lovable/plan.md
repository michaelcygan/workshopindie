# Chicago Resources Seed (40 entries)

Pure data seeding into the existing Resources system. No schema changes, no new UI, no new categories.

## Verified current state

- Chicago city Group exists and is unique: slug `chicago`, kind `city`, linked to the Chicago city record.
- `resources` and `group_resources` are both currently empty (0 rows), so nothing existing can be disturbed.
- The Resources tab already appears automatically once a Group has at least one published attached resource.

## What gets seeded

All 40 supplied records, exactly as given: existing category IDs only, `location_text` = "Chicago", `image_url` = null, `fields` = `[]`, `is_published` = true, addresses as supplied (null for Chicago Mastering Service and ArtBuilds), and `city_id` set to the existing Chicago city record.

Each is then attached to the Chicago city Group with the supplied `display_order` 0–39.

## Idempotency

The seed runs as a single data statement set that can be re-run safely:

- Resources are matched first on canonical `website_url`, falling back to a normalized (lowercased, trimmed) name match. A match updates the row in place; no match inserts a new one.
- Group links are inserted only where a `(group_id, resource_id)` pair does not already exist, so re-running never duplicates a relationship and never removes links to other Groups.
- No unique constraint is added; matching is done in the seed statement itself.
- Nothing is deleted, and unrelated resources are untouched.

## Technical notes

- Delivered through the data-change (insert/update) path, not a schema migration, since no structure changes.
- Chicago Group and city IDs are resolved by `slug = 'chicago'` lookups inside the statement rather than hardcoded UUIDs.
- Category values are taken from `RESOURCE_CATEGORY_IDS` in `src/lib/resources/types.ts`; no new IDs.

## Verification after seeding

- Query counts: exactly 40 resources, 40 Chicago links, no duplicates; re-run the seed and confirm counts are unchanged.
- Load the Chicago Group in a browser (desktop and mobile widths): Resources tab present, list renders in `display_order`, sparse records (ArtBuilds, Chicago Mastering Service) render without an address and without errors, website links point at the canonical URLs.
- Load a Group with no resources and confirm the tab is still absent with no empty state.
- Confirm `/admin/resources` lists and searches the seeded records and shows Chicago as the attached Group.
