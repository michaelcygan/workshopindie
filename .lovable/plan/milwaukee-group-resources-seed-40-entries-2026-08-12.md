# Milwaukee Group Resources Seed (40 entries)

Pure data seeding into the existing Resources system. No schema changes, no new UI, no new categories, no new admin surface.

## Verified current state

- The Milwaukee city Group exists and is unique: slug `milwaukee`, kind `city`, linked to the Milwaukee city record.
- `resources` currently holds 40 rows, all linked to the Chicago Group (40 `group_resources` rows, Chicago only). Nothing Milwaukee-related exists yet.
- City records in Wisconsin: only Milwaukee and Madison. There are no records for Wauwatosa, Greenfield, Brookfield, Elm Grove, or New Berlin.
- The Resources tab already appears automatically once a Group has at least one published attached resource, and stays hidden otherwise.

## What gets seeded

All 40 supplied records exactly as given: existing category IDs only, `image_url` = null, `fields` = `[]`, `is_published` = true, `location_text` set to the actual municipality (Wauwatosa, Greenfield, Brookfield, Elm Grove, New Berlin, Wisconsin, Milwaukee County), and addresses as supplied — including the intentional nulls for Kneeverland Productions, Art CPR, and Milwaukee County CAMPAC.

Each is then attached to the Milwaukee city Group with the supplied `display_order` 0–39.

**city_id assignment**
- Resources whose municipality is Milwaukee → the existing Milwaukee city record.
- Wisconsin Arts Board (Madison) → the existing Madison city record.
- Everything else (suburbs, Milwaukee County) → `city_id` = null, since no matching city record exists and the location architecture is not being expanded here.

**Address verification pass**
Before the seed runs, canonical URLs and addresses are checked against current official sites, with the supplied data as the second authority. Recently moved entries (House of RAD, Anchor Press, MARN, Danceworks, Woodland Pattern) keep their current addresses. Where an official site publishes no reliable street address, the address stays null rather than being guessed. Funding entries stay evergreen — no deadlines, amounts, or cycle state in the copy.

## Idempotency

The seed runs as a single data statement set that can be re-run safely:

- Resources are matched first on canonical `website_url`, falling back to a normalized (lowercased, trimmed) name match. A match updates the row in place; no match inserts a new one.
- Group links are inserted only where a `(group_id, resource_id)` pair does not already exist; existing pairs have `display_order` updated. Re-running never duplicates a relationship and never removes links to other Groups.
- No unique constraint is added; matching happens inside the seed statement.
- Nothing is deleted. Chicago resources, their links, and any manually created resources are untouched.

## Technical notes

- Delivered through the data-change (insert/update) path, not a schema migration — same convention used for the Chicago resources seed.
- Milwaukee Group and city IDs are resolved by `slug = 'milwaukee'` lookups inside the statement rather than hardcoded UUIDs; Madison likewise by slug.
- Category values come from `RESOURCE_CATEGORY_IDS` in `src/lib/resources/types.ts`; no new IDs.
- No changes to `group-resources-tab.tsx`, `resources.functions.ts`, `g.$slug.index.tsx`, or `admin.resources.tsx`.

## Verification after seeding

- Query counts: 40 Milwaukee links, no duplicate resource rows or joins, Chicago's 40 links unchanged; re-run the seed and confirm counts are identical.
- Load the Milwaukee Group in a browser (desktop and mobile widths): Resources tab present, list renders in `display_order`, address-less records (Kneeverland, Art CPR, CAMPAC) render cleanly, suburb labels display their real municipality, Wisconsin Arts Board renders normally, website links resolve.
- Load a Group with no resources and confirm the tab is still absent and a direct `?t=resources` request still falls back to the default tab.
- Confirm `/admin/resources` lists and searches the seeded records, shows Milwaukee as the attached Group, and that edit/publish/attach/detach/reorder still work.
