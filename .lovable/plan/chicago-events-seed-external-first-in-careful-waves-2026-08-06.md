# Chicago Events Seed — external-first, in careful waves

## What I found in the current architecture

- `group_events` already has the right columns: `source`, `external_url`, `external_organizer`, `is_official`, `creative_category`, `series_key`, `venue_city_id`, `timezone`, `is_recurring`, `recurrence_label`.
- The **Create Event** path (`createEvent` / `createEventSeries` in `src/lib/group-events-admin.functions.ts`) already forces `is_official: false` when `source === "external"` and carries `external_url` / `external_organizer` into the recurring template.
- The **Import from link** dialog (`src/components/admin-import-event-dialog.tsx`) is the broken one: its `basePayload()` hardcodes `is_official: true` and never sends `source`, `external_url`, or `external_organizer`. It also has its own local `Kind` union that is missing `lineup`, and it stamps the admin's browser timezone rather than the venue timezone.
- The public event page (`src/routes/g.$slug.e.$eventSlug.tsx`) renders an "Official" chip from `is_official` and shows organizer attribution via `resolveEventHost`, but there is **no** prominent "Official event page / Tickets & details" link built from `external_url`.
- Chicago exists as a city Group (`/g/chicago`, kind `city`) with a resolved city row; the five Medium Groups (`music`, `writing`, `visual-art`, `film-video`, `games-tech`) exist as system Groups and are auto-linked from `creative_category` by triggers.
- Idempotency lever that already exists: unique index on `(series_key, starts_at)` where `series_key` is not null. No new column is needed.

## Wave 1 — Fix external-event provenance (code only)

1. `admin-import-event-dialog.tsx`
   - Add fields to the review form: **Source** (Workshop / External), **External URL** (prefilled with the imported source URL), **External organizer** (prefilled from the parsed host/venue when available).
   - `basePayload()` sends `source`, `external_url`, `external_organizer`, and drops the hardcoded `is_official: true` (let the server rule decide).
   - Replace the local `Kind` union with `EventKind` from `src/lib/events/kinds.ts` so `lineup` is selectable.
   - Add a timezone field defaulting to the venue-derived / admin timezone so imports are not silently stamped with the importer's clock.
2. Public event page
   - Suppress the "Official" chip whenever `source === "external"`; show a restrained **"External event"** chip instead.
   - Add a single clear **"Official event page"** (or "Tickets & details") link built from `external_url`, placed near the RSVP block in the existing visual language — no redesign.
   - Add one line of quiet copy under Workshop RSVP for external events: RSVP here is a Workshop intention signal only; tickets, signup lists, cover, and age rules live with the organizer.
3. Same external chip/link treatment on `event-card.tsx` only if it is missing (it already detects `isExternal`).

## Wave 2 — Verify each of the 20 concepts

For every event I will fetch the organizer's or venue's own current page (site, official calendar, or the organizer's primary social listing when that *is* the canonical source) and record: exact public title, organizer, canonical URL, active/not, next occurrence, recurrence, start time, end time when published, venue name and street address, age/cover/ticket notes, performer-signup notes, a short paraphrased Workshop description, event kind, creative category, and any extra Medium Group.

Anything ambiguous or stale is **not** published — it goes into the Wave 7 omitted list.

## Wave 3 — Mapping rules

- Primary Group = **Chicago city Group** (resolved by slug, never a hardcoded UUID); the Chicago Group owns the Workshop event URL.
- `creative_category` drives Medium Group cross-listing through existing triggers; `extra_group_ids` only for a genuine second medium.
- Kinds limited to the existing `EVENT_KINDS`: open mics / jams / storytelling-signup -> `open_mic`; writers groups, figure drawing, craft nights -> `workshop_irl`; curated storytelling / live-magazine / theatre -> `lineup`.
- `timezone: "America/Chicago"`, real `venue_address`, city resolved through the existing city-resolution path (`resolveEventCity` + venue coords), `source: "external"`, `is_official: false`.

## Wave 4 — Recurrence

- **WEEKLY series** for the truly weekly ones (Uncommon Ground Sun, Gallery Cabaret Tue jam, Gallery Cabaret Thu mic, Cole's Wed, Eli Mon/Thu/Fri, Jarvis SquEAR Wed, Fuller's, Platform Studios, Paper Machete if re-verified weekly, Infinite Wrench). Multi-weekday events get **one series per weekday** (Fuller's Wed + Thu; Platform Tue/Wed/Thu; Infinite Wrench Fri/Sat/Sun).
- **No MONTHLY recurrence** for nth-weekday rules. Story Lab, This Much Is True, Do Not Submit (three locations), Uptown Poetry Slam, TEST, MissSpoken get **individual dated occurrences** for the next ~4–6 months, only for dates the organizer has actually published.
- Where an official source gives no end time, I use a conservative internal duration purely so lifecycle works, and the page does not present that end time as organizer-provided.

## Wave 5 — Idempotent seeding

- A single admin-only server function `seedChicagoEvents` (`src/lib/seed/chicago-events.functions.ts`) plus a plain data manifest module holding the verified 20. Admin-gated, dry-run flag supported, callable from `/admin/events`.
- It resolves Chicago and Medium Groups by slug at runtime, and reuses `createEvent` / `createEventSeries` logic rather than ad-hoc SQL.
- **Deterministic `series_key`** per series (e.g. `chi-gallery-cabaret-open-mic-thu`) so the existing unique `(series_key, starts_at)` index makes re-runs no-ops; existing rows get their external metadata **updated in place** instead of duplicated.
- One-off dated occurrences dedupe on `external_url` + normalized title + `starts_at` within Chicago.
- No new database column, no fake RSVPs, no fake users.

## Wave 6 — UX QA

Browser-driven checks: logged-out and logged-in Chicago discovery, event inside Chicago Group, appearance in the Medium Group, public shareable URL, mobile layout, venue/address, organizer attribution, official-page link, RSVP copy, a recurring instance, add-to-calendar, a past occurrence, and the next occurrence materializing.

## Wave 7 — Final report

Seeded vs omitted concepts, count of upcoming occurrences, confirmation that zero external events are `is_official: true`, canonical URLs stored, Chicago resolved, weekly recurrence correct across a DST boundary, no nth-weekday events in MONTHLY, a second seed run creating nothing, and no fabricated attendance.

## Technical notes

Files touched: `src/components/admin-import-event-dialog.tsx`, `src/routes/g.$slug.e.$eventSlug.tsx`, possibly `src/components/event-card.tsx` and `src/components/event-rsvp-block.tsx`, plus new `src/lib/seed/chicago-events.data.ts` and `src/lib/seed/chicago-events.functions.ts`, and a small entry point in `src/routes/admin.events.tsx`. No schema migration is expected; if verification turns up a genuine blocker I will surface it before adding one.
