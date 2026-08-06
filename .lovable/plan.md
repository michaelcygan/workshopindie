# International-First Geography & Automatic Scene Provisioning

Workshop stops having a fixed launch-city list. Any creator anywhere can pick their real city; if Workshop doesn't have it yet, it is created once, safely, together with its official city Group — and the creator becomes its first ordinary member.

## What exists today (verified)

- `public.cities` has: name, state_region, country (free text), slug, timezone, lat/lng. No country code, no provider identity, no lifecycle, no link to its Group.
- 10 city Groups exist (Chicago, Austin, SF, London, Berlin, Mexico City, Toronto, New York, LA, Tokyo), all `kind = city`, `is_official = true`, each already carrying `city_id`.
- Two overlapping auto-creation paths already exist in the database: a trigger that mirrors every new city row into a Group, and `ensure_home_city_group` which creates the Group and joins the user when `home_city_id` is set. These must be consolidated into the single new primitive.
- `/me/edit` uses a plain dropdown of all cities. `CityCombobox` (used by Collab/Events/Gallery filters) searches only existing rows with an unindexed `ilike %query%`.
- `venues.functions.ts` already resolves places via OpenStreetMap/Nominatim, but it trusts client-supplied city name/country and inserts cities directly — this is the abuse hole to close.
- `geo.functions.ts` downloads the whole cities table per request, picks the globally nearest city with no radius cap, and compares a 2-letter country code against a country name string.
- No PostGIS, `unaccent`, or `pg_trgm` installed yet.

## Waves

**1 — Canonical geography schema.** Extend `cities` (not replace): `country_code` (ISO alpha-2), `latitude/longitude` kept, `timezone` (IANA), `place_provider`, `place_provider_id`, `location_kind`, `status` (provisioning/active/paused/failed/merged), `provisioned_at`, `provisioned_by`, `provision_source` (user/admin/migration), `provision_error`, `official_group_id`, `merged_into_city_id`. Unique index on (provider, provider_id). Partial unique index guaranteeing at most one active official `kind = city` Group per city. `groups.city_id` stays non-unique so scene groups can share a city.

**2 — Backfill migration.** Existing 10 cities become `status = active`, `provision_source = migration`, country codes derived, `official_group_id` matched to their existing Group by `city_id` + `kind = city` + `is_official`. Ambiguous or unmatched rows are left flagged for admin review, never guessed or deleted. No slug, ID, URL, membership, or content changes.

**3 — One provisioning primitive.** `ensureLocationAndOfficialGroup()` — an authenticated server function wrapping a single atomic Postgres RPC. Client sends only a provider place identity (plus a signed payload of the resolved result); the server re-resolves and validates it against the provider, rejects anything that isn't a groupable locality (addresses, venues, POIs, countries), then: find-by-provider-identity → return existing, else insert city + collision-safe slug (`chicago`, `sao-paulo`, disambiguating only on collision: `cambridge-ma`, `cambridge-uk`) + create the official Group (`kind = city`, open, public, `is_official`, deterministic copy: name "Berlin", tagline "Creative community in Berlin.") + link `official_group_id` + mark active. Idempotent and race-safe: two people choosing Lagos at once yield one city and one Group. The existing mirror trigger and `ensure_home_city_group` are retired/redirected into this path, and `resolveVenueAndCity` is refactored to call it instead of inserting cities from client data. A server-only low-level group-insert helper is shared with admin group creation, with separate authorization.

**4 — Worldwide location search UI.** `GlobalLocationCombobox`, styled exactly like the current combobox. Ranks existing Workshop cities first, then live worldwide provider results behind a thin provider abstraction (OpenStreetMap/Nominatim, already used for venues, with room to swap). Results disambiguate as locality / region / country ("Portland — Oregon, United States" vs "Portland — Maine, United States"). Full Unicode: São Paulo, Reykjavík, Kraków, München. No lat/lng/timezone/provider IDs surfaced.

**5 — Profile location as the scene-launch surface.** `/me/edit` swaps the `<select>` for the new combobox; location stays optional. Existing city → just save `city_id`. New canonical city → provision, save, join the official Group as a plain member (never owner/steward), initialize `home_city_id` only if empty. Changing city later never removes prior Group membership. Subtle success state: "Welcome to Workshop Lagos." with a View group action.

**6 — Local Groups populate naturally.** Profile-city selection joins the official Group. Collabs with an explicit `city_id` and physical Events with a canonical city associate to that official city Group through existing relationships (no duplicated records). Works are *not* auto-posted — instead a pre-checked, removable "Also share to Berlin" suggestion. Creation started inside a Group keeps current behavior.

**7 — Provisioning vs browsing.** Only explicit authenticated writes may provision: profile location, confirmed city on location-specific content, admin Launch. Never: search/filter typing, browsing `/cities`, IP geolocation, page loads, autocomplete, anonymous traffic.

**8 — IP geography rebuilt.** Nearest-active-city moves into an indexed database function (geographic index; PostGIS if available, otherwise an indexed bounding-box + haversine RPC), with a maximum radius so a visitor in Nairobi gets *no* city rather than London. Country matching uses stored `country_code` vs the Cloudflare code. Active cities only; paused/merged never suggested. Never provisions. No full-table load per request.

**9 — Search that scales.** Enable `unaccent` + `pg_trgm`, add a normalized/indexed name column and a ranked search RPC returning a small result set, so "Sao Paulo" finds "São Paulo" without a table scan.

**10 — city_id vs home_city_id.** Keep both with intentional meaning: `city_id` = where the creator is based (public identity); `home_city_id` = which local context their feed defaults to. Both initialize together on first pick; afterwards each is edited independently. Copy explains this in plain language.

**11 — International-native.** No US assumptions: region/admin-area not "state", ISO country codes, Unicode names preserved, IANA timezones, UTC storage with `Intl`-based rendering. UI stays English-first; nothing blocks later localization. Existing profile-language system untouched.

**12 — `/admin/geo` becomes the control room.** Keep the world map and city/country activity tables; add a management layer: search the same worldwide provider, Launch now / Add to queue for missing places; View group, View activity, Pause, Unpause, Repair, Feature for existing ones. Lightweight launch queue with bulk launch that calls the identical provisioning primitive. Shows origin (auto-provisioned by user / admin-launched / migrated), provisioned time, member count, activity. Safe duplicate merge (repoint relationships, mark `merged`) rather than delete. Steward appointment so the first creator never becomes a de facto admin.

**13 — Abuse resistance.** Users cannot write `cities` directly (RLS tightened to admin + the SECURITY DEFINER primitive). Provider identity validated server-side. Rate limits on genuinely-new provisioning only (picking an existing city is free); admins exempt. Every provisioning event written to the existing admin audit log. Guards against duplicate races, slug collisions, provider retries, and archiving a Group that a city still points at.

## Acceptance checks

Existing-city pick creates no duplicates and joins the existing Group; first Lagos pick creates exactly one city + one Group, publicly addressable immediately; concurrent Lagos picks converge to one; same-named cities in different countries coexist; diacritics render and are searchable; slugs stay stable; changing city keeps old membership; anonymous search and IP inference never provision; IP never assigns an absurdly distant city; paused/merged never suggested; Chicago and all existing data survive; admin launch and batch launch use the same primitive; forged place metadata is rejected; no service-role credential reaches the client. Typecheck, lint, tests and build run clean.

## Technical notes

- Provisioning lives in a `SECURITY DEFINER` Postgres function called from a `createServerFn` with `requireSupabaseAuth`; advisory locks keyed on provider identity make it race-safe.
- Provider access is server-side only, behind `src/lib/geo/provider.server.ts`, so the vendor can be swapped without touching UI or schema.
- Delivered in ordered migrations: schema → backfill → primitive/RPC → search indexes → RLS tightening, so existing IDs and URLs never move.
