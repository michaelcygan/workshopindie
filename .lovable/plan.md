## Auto-creation & affiliation (1, 2, 3) — already wired, verify only

Good news: the data model already does most of this. No new tables needed.

- **Cities auto-create** when anyone picks a place: `resolveCityFromOSM` in `src/lib/cities.functions.ts` upserts a row in `cities` keyed by `slug` (e.g. `chicago-us`) whenever a profile, work, collab, or workshop form resolves a location through OpenStreetMap. So any new city the user types in *already* gets a city page at `/cities/{slug}`.
- **Creators auto-listed**: `profiles.city_id` is set on profile save; the city page already queries `profiles where city_id = ?` and shows them under "Local creators".
- **Works auto-listed**: `works.city_id` is set on publish; the page already queries them under "Made here".
- **Collabs auto-listed**: `collab_posts.city_id` is set on create; collabs render under "Open calls". One gap: `collab_posts.also_cities` (array of secondary city_ids) is currently ignored — extend the collabs query to `OR also_cities @> ARRAY[city.id]` so cross-posted calls show up.

Action: no migration, just verify each form (profile edit, works/new, collab/new, workshops/new) routes its city pick through `resolveCityFromOSM`, and extend the collabs query for `also_cities`.

## Fix the broken creator link (4)

Mike has no `username`, so `<Link to="/u/$username" params={{ username: p.username ?? "" }}>` resolves to `/u/` → 404. Two fixes, do both:
- Skip rendering as a link when `username` is null; render as a plain card (or eventually link to a fallback `/u/by-id/$id`).
- Also fix the same pattern on `WorkCard` credits.

## Filter creators by medium (4)

Above the creators grid, add a horizontal `CategoryScroller` (already exists in `src/components/`) that filters the local creators list against `profiles.categories @> ARRAY[selected]`. "All" by default. Pure client-side filter — small enough at v1.

## Repurpose "Upcoming Workshops" (5)

Scheduled workshops aren't live yet. Replace that section with two stronger v1 signals that actually drive collaboration:

1. **"Open to collaborate here"** — top of page, right under the header. Pulls active `collab_posts` for the city (already queried, just promote it up the page and make it the hero block). Each card shows category chip, title, timeline, and a "Reach out" CTA. If empty: a single inline "Post a collab in {city}" button → `/collab/new?city={slug}`.

2. **"Recently made here"** — keep the existing "Made here" works grid but rename and tighten to 6 items with a "See all in {city}" link to `/gallery?city={slug}` (the gallery filter we already built).

Drop the "Upcoming Workshops" section entirely for now; add a small one-liner at the bottom: "Scheduled workshops coming soon — start a standing meetup in the meantime."

## City page v2026 layout (still simple)

Final stacking order, mobile-first:

```text
[← All cities]
[📍 Chicago, IL USA]                        [+ Post a collab here] [+ Standing meetup]

Open to collaborate · {n}                   [See all open calls →]
  · grid of active collab cards (or empty-state CTA)

Standing meetups · {n}                      [+ Start one]
  · grid (existing)

Recently made here · {n}                    [See all in Chicago →]
  · 6-up WorkCard grid (existing, capped)

Local creators · {n}                        [filter chips: All Film Music Writing …]
  · grid (existing, with medium filter + fixed links)

Scheduled workshops — coming soon. Start a standing meetup in the meantime.
```

## Scale considerations (not built in v1, just designed for)

- City pages are O(cities) — fine; list page already paginates implicitly via ordering. When >50 cities, add server-side search on `/cities` (typeahead over `cities.name`).
- Creator lists are capped at 12; switch to keyset pagination by `work_count` when any city exceeds that.
- `also_cities` on collabs lets a single post surface in multiple city feeds without duplication.
- Future: a `city_followers` table for "Follow this city" notifications (new collab, new work). Schema is one composite-PK table; deferred to v2.

## Files to touch

- `src/routes/cities.$slug.tsx` — reorder sections, add medium filter for creators, fix `Link to /u/$username` (skip when null), drop workshops section, add "Post a collab here" header button and `also_cities` to collabs query.
- `src/components/work-card.tsx` — guard credit links against empty username (quick audit).
- No new migrations. No new server functions.

## Out of scope (call out)

- No new auth, no new tables, no email/notifications.
- No map view (nice but defer).
- No "Follow city" (defer to v2 with a real notifications surface).