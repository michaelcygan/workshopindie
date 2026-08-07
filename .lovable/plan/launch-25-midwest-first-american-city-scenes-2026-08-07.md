# Launch 25 Midwest-first American city scenes

Expand Workshop's geography by 25 net-new US cities (Milwaukee first) using the geography flow that already exists — no hand-written city rows, no new provisioning path.

## What I confirmed first

- Workshop currently has **10 localities**: Chicago, New York, Los Angeles, Austin, San Francisco, London, Berlin, Tokyo, Mexico City, Toronto. **None of the 25 primary targets exist yet**, so the full primary manifest is available and no reserve city is needed unless a provider lookup fails.
- All 10 existing cities were created by an old migration and have **no `place_provider` / `place_provider_id`**, so they can't collide with provider-identity dedupe. (Not in scope to backfill here.)
- The canonical path is intact: `enqueueLaunch` → `launchQueueEntry` → `resolveProviderPlace` → `ensureLocalityFromPlace({ isAdmin: true, join: false })` → `provision_locality`, which owns the city row, slug collision handling, the official city Group, and the audit record.

## Approach

Add the smallest possible admin-only batch helper that drives the *existing* flow, then run it from `/admin/geo`.

1. **Extract, don't duplicate.** Pull the body of `enqueueLaunch` into a private `queuePlaceForLaunch(providerId, userId)` helper in `src/lib/geo/admin.functions.ts`. Both the existing single-city launch and the new batch call it, alongside the existing `launchQueueEntry`. One provisioning implementation remains.
2. **New server fn `runCityLaunchBatch`** (same file, same `requireAdmin` + `requireSupabaseAuth` pattern):
   - Input: an optional cursor/offset. No client-supplied geography — only a manifest index.
   - For each manifest entry, **sequentially**: `searchProviderLocalities("City, State, United States")` → pick the first result where `countryCode === "US"`, the state/region matches the expected state, and the name matches the expected locality → take its `providerId` → `queuePlaceForLaunch` → `launchQueueEntry`.
   - If no result passes validation, record `unresolved` and move on (never pick result #1 blindly, never invent coordinates/IDs).
   - Returns a per-city result row: requested name, state, canonical name, provider ID, created/existing, city ID, city slug, group ID, group slug, queue status, note.
3. **Rate discipline.** Sequential only, ~1.1s spacing between Nominatim calls, in-run cache so a city is never searched twice. Because ~25 cities × 2 provider calls exceeds a comfortable request budget, the batch processes a **bounded chunk (5 cities) per invocation** and returns a cursor; the admin UI advances the cursor automatically until done. If the provider returns rate-limit/error responses, the batch **stops cleanly** and returns progress — the launch queue makes it resumable.
4. **Manifest** lives in a plain data module `src/lib/geo/city-launch-manifest.ts`: the 25 primary targets in the requested order, each with `{ city, state, query }`, followed by the 13 reserves. The batch walks primaries first and only pulls from reserves if a primary is already an existing Workshop locality or fails to resolve, until 25 net-new cities exist.
5. **UI**: one "Launch Midwest batch" button plus a progress/results table inside the existing `LaunchQueuePanel` on `/admin/geo`. No redesign of the console.

## Guarantees kept

- `join: false` — no admin memberships in the 25 new city Groups.
- Idempotent: `city_launch_queue` upserts on provider identity; `ensureLocalityFromPlace` short-circuits on known provider IDs; `provision_locality` is the only creator. Re-running reports "existing" and creates nothing.
- Launched queue rows are preserved as provenance — nothing is auto-deleted.
- No content seeding: no events, works, collabs, posts, members, or RSVPs.

## Verification

- Query each created city for canonical name, state/region, country/US code, provider identity, provider coordinates, status, `provision_source = 'admin'`, and a resolvable `official_group_id` + Group slug; confirm one Group per city and no duplicates.
- Confirm no `group_members` row was created for the launching admin in any of the new city Groups.
- Confirm each city appears in `/admin/geo` with a `launched` queue entry pointing at the correct `city_id`.
- **Milwaukee acceptance test**: prove Milwaukee resolves as a valid event geography in the authoring location picker (no event created).
- **Second-run test**: run the batch again and confirm 0 new cities, 0 new Groups, 0 new memberships.

## Final report

A table of `Requested city | State | Provider canonical name | Provider ID | Created? | City ID | City slug | Official Group ID | Group slug | Queue status | Notes`, plus counts (attempted, skipped-existing, reserves used, created, total cities after) and any failed resolutions or launches with reasons.

## Technical notes

- Files touched: `src/lib/geo/admin.functions.ts` (extract helper + new batch fn), new `src/lib/geo/city-launch-manifest.ts`, `src/components/admin/launch-queue-panel.tsx` (batch button + results). No schema migration, no changes to `provision.server.ts` or `provider.server.ts`.
- The batch runs under the authenticated admin's identity, so `queued_by`, `provisioned_by`, and the audit actor are that admin — no hardcoded UUIDs.
- Execution requires an admin-authenticated session; I'll drive the batch through the admin console in the preview and report results.
