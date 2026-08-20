# Remote Events — /events/remote

A permanent, shareable URL for the Remote attendance state of the existing Events calendar. Same events, same cards, same event pages, same RSVP flow — the route just fixes the attendance filter to "remote" on entry, exactly like `/collab/remote` does for Collabs.

## What Remote means

Reuses the discovery semantics already in place: `format = online` and `format = hybrid` are both remotely attendable; `in_person`-only events are excluded. Hybrid events intentionally appear under both In person and Remote. City, Group, and venue metadata on a remote event is untouched — it just never restricts the Remote calendar.

## Routes and navigation

- `/events` — the calendar as it is today.
- `/events/remote` — the same page with Remote active, city picker and map hidden, and the IP-city default never applied.
- Attendance toggle becomes **All / In person / Remote**:
  - Remote from `/events` → `/events/remote`
  - All from `/events/remote` → `/events`
  - In person from `/events/remote` → `/events?format=in_person`
  - Switching to Remote drops `city` / `cityName`
- Secondary filters (`medium`, `topic`, `when`, `q`, `kind`, `daypart`, `mine`) compose on the Remote route and keep the visitor there; "Clear all" returns to the unfiltered `/events`.
- Legacy `/events?format=online` history-replaces to `/events/remote`, carrying compatible filters and attribution params (`wtl`, `utm_*`). A stray `?format=all` on the Remote route is ignored — the route wins.
- `/go/:slug` keeps working as-is with `/events/remote` as a destination.

## Copy

Title "Remote Events", supporting line "Creative events you can join from anywhere.", empty state "No remote events on the calendar yet." with the existing browse-Groups / host-an-event pointers. Cards keep the current EventCard; `online` reads as **Remote**, `hybrid` reads as **Hybrid · Remote + in person** so a hybrid event is never presented as remote-only.

## Correctness fixes carried by this work

- **Topic filtering moves server-side.** Today the page loads events and then filters by topic in the browser, after the query limit and series collapse — a valid topic URL can come back empty. Topic becomes part of the shared discovery input: matching event ids resolve through the existing `topics` / `group_event_topics` tables and constrain the query before its limit. No second taxonomy.
- **Topic options stop coming from the loaded batch.** They are derived from topics attached to events eligible under the current attendance state, so a Remote topic list never advertises in-person-only topics (and filter counts on the Remote route become Remote-aware or are dropped).
- **Featured events respect Remote.** `listFeaturedEvents` gains the same attendance filter so the Featured module can't put an in-person-only event above a Remote result set.
- **My RSVPs respects Remote.** With `mine=true` on the Remote route, RSVPs are limited to events whose format is `online` or `hybrid`.

## Unchanged

Event creation and editing, the composer's existing online/hybrid values and URL field, group ownership and attribution, RSVP / waitlist / access / auto-join, and the canonical event page at `/g/:groupSlug/e/:eventSlug`. Meeting-link privacy is preserved: public discovery keeps returning only whether a link exists, never `online_url`, and nothing about the join link enters card data, metadata, or JSON-LD.

## SEO

`/events/remote` gets its own title ("Remote Events — Workshop"), description ("Creative events, sessions, and gatherings you can join from anywhere."), canonical and Open Graph/Twitter tags with `og:type = website`, plus a static sitemap entry. Filtered variants canonicalize to `/events/remote`; JSON-LD list items keep pointing at each event's own page.

## Technical notes

- Extract the body of `src/routes/events.index.tsx` into a shared `src/components/events/events-directory.tsx`, driven by props for the attendance state, copy, and how filter changes navigate. `/events` and `/events/remote` are thin route files over that one component — no forked page.
- New `src/routes/events.remote.tsx` (static route; there is no `/events/$slug` route, so no slug collision). Search schema shared with `/events` minus the location params, with passthrough for attribution.
- `src/lib/events/discovery.server.ts`: add `topic` to `DiscoveryFilters`, resolved to event ids before the query's `.limit()` and series collapse, mirroring the existing `medium` handling.
- `src/lib/group-events.functions.ts`: thread `topic` through `listPublicEvents`, add the attendance filter to `listFeaturedEvents`, and apply the remote-only constraint to the My-RSVP readers.
- `src/routes/sitemap[.]xml.ts`: add `events/remote` to the static path list.
- No database or RLS changes.

## Verification

Hard refresh of `/events/remote` returns only online/hybrid events, including in Featured. Each filter composes and back/forward restores state. `/events?format=online&utm_source=x` normalizes to `/events/remote` with attribution intact. Typecheck, lint, tests, and build pass.
