# Workshop Open House: canonical venues + Capacity/Overflow

Open House stays an ordinary Workshop Event. No new event system, no venue dashboard, no public venue directory. Everything below is additive to the current `group_events` model, event composer, RSVP flow, recurring series, and event page.

## 1. Database (one migration)

On `group_events`:
- `overflow integer not null default 0` with a `check (overflow >= 0)` constraint.
- `workshop_venue_key text null` (no FK — the registry is code-backed).
- `venue_policy_confirmed_at timestamptz null` + `venue_policy_confirmed_by uuid null` so an admin's "I confirmed with the venue" decision is stored per occurrence, never globally.

Existing rows get `overflow = 0`, so current behavior is unchanged. Capacity keeps its current meaning (intended attendance).

`reserve_event_rsvp` is replaced so the authoritative ceiling is `capacity + coalesce(overflow,0)`. When capacity is null there is still no ceiling. Waitlist behavior, concurrency (`FOR UPDATE`), and return values stay as they are today.

## 2. Canonical venue registry (code)

New `src/lib/events/workshop-venues.ts` — a typed, frozen array of the eight Chicago records with the exact fields requested (key, name, address, neighborhood, venue_type, is_workshop_venue, is_open_house_home_base, walk_in_supported, walk_in_policy_verified, group_policy_trigger, reservation/food/age/wifi/indoor-outdoor/scheduling notes, source_url, policy_last_verified_at, active). Unknowns stay `null` — no invented policy, no fabricated URLs. This replaces any prior Chicago venue list.

Two exported helpers:
- `publicVenueDetails(key)` — only the publishable subset (name, neighborhood, type, address, first-come note, age, food, wifi, indoor/outdoor, official link).
- `evaluateVenuePolicy({ key, capacity, overflow, confirmed })` → `eligible | requires_review | walk_in_unverified | group_trigger_reached` plus a short reason. Optional reservation ranges (Cara Cara, District Brew Yards) are never hard blocks; Still Life is always review-until-verified.

## 3. Admin composer

`src/routes/admin.events.tsx` gains, above the existing OpenStreetMap `VenueAutocomplete` (in-person/hybrid only), a compact "Workshop venues" list with Off Color / Mousetrap first, labelled internally "Chicago home base". Selecting one fills name/address/coords, resolves the city through the existing `resolveVenueAndCity` server path (no hardcoded UUID), and sets `workshop_venue_key`. Editing the name or address away from the canonical record clears the key. OSM search and manual entry stay untouched, and Off Color is a default suggestion, never auto-assigned.

Overflow input sits immediately after Capacity with the requested copy and a live line: "Up to 15 RSVPs will be accepted: 10 intended + 5 overflow." Overflow is disabled while capacity is empty. Policy warnings from `evaluateVenuePolicy` render before publish, with an explicit admin confirmation checkbox when review is required.

## 4. Server enforcement

`src/lib/group-events-admin.functions.ts` validates `overflow` (int ≥ 0) and `workshop_venue_key` (must be a known active key), clears the key when the snapshot no longer matches, and re-runs `evaluateVenuePolicy` server-side — a review-required event cannot be published without a stored confirmation, regardless of client state. `src/lib/event-series.server.ts` adds `overflow` and `workshop_venue_key` to `TEMPLATE_COLUMNS` so future occurrences inherit them. Event select lists add `overflow` and `workshop_venue_key`; private policy metadata never leaves the registry module for public queries.

## 5. Event page

`src/components/event-location-card.tsx` renders, only when a venue key is present, a restrained details block from `publicVenueDetails` plus the standard disclaimer: "Workshop organizes this gathering using the venue's ordinary public seating. The venue is the meeting place and is not a sponsor or organizer unless stated otherwise." Hostless Open House events add the "no formal host or reserved table / open Now to check in" note. Host line stays Workshop or the owning Group. Nothing internal (verification state, triggers, automation eligibility, confirmation state) is rendered. Events without a key render exactly as today.

The Now composer for these events gains three prefill-only suggestion chips ("I'm here — sitting…", "Where is everyone sitting?", "I'm on my way — arriving around…"). Nothing posts automatically; check-in stays explicit.

## 6. Tests

New `src/lib/events/workshop-venues.test.ts` and additions to the series tests cover: no-overflow parity; 10+5 accepting 15 and rejecting/waitlisting the 16th; negative overflow rejected; empty capacity = no ceiling; waitlist promotion at capacity+overflow; series retaining overflow and venue key; manual venue edit clearing the key; Begyle at 15, Half Acre at 10, Marz at 10 warning; Cara Cara and District Brew Yards optional ranges not blocking; Still Life requiring review; Off Color first and flagged home base; public detail projection excluding private fields.

Then: vitest run, tsgo typecheck, production build.

## Not in scope

Venue partnerships, booking, payments, a public venue directory, a rotating-series scheduler, or any change to event URLs, group membership, or the check-in model. A future scheduler can reuse the registry and the policy helper as-is.
