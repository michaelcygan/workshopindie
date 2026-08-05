# Events: Living Flyer Launch Refinement

One permanent Event URL that reads as a public flyer before, a room during, and a calm archive after. Built as a careful simplification on top of the existing Event foundations — no second Event product, photo store, RSVP system or recurrence model.

## What I verified in the current code

- Canonical route `src/routes/g.$slug.e.$eventSlug.tsx` (644 lines) stacks companion panel, who-strip, attendee work, showcase, photos, wall and about; some content appears twice during the live window.
- `group_events` has **no** `published_at` / `archived_at`. Live data is small: 8 `scheduled`, 2 `completed`, no drafts or canceled rows — backfill is low risk.
- `getEventPhase` uses a padded ±60 min pre/live/post window.
- `EventCompanionPanel` calls `autoCheckInToEvent` from a `useEffect` on page open; `listCheckedInAttendees` runs through an anonymous client, so the roster is public.
- The `group_events` public read policy allows any row with `visibility = 'public'` regardless of status — **a public-visibility draft would be publicly readable today**.
- `group_event_comments` (the Wall) is readable by anyone who can see the Event, not just attendees. `event_photos` is already attendee-gated and has no `comment_id`.
- `is_event_wall_sealed()` seals at `ends_at + 3 days`.
- `online_url` is in the shared public select list used by `getEventBySlug`, discovery and card DTOs.
- Discovery filters upcoming with `starts_at >= now`, so a running Event drops out of feeds.
- `event_series` has a public read policy for any live group, exposing template addresses/links.
- `group_events.promo_pass_months` defaults to **1**, so ordinary RSVPs can grant Plus.
- RSVP status enum still carries `maybe`; several reads include it.

## Waves

Each wave ends at a deployable boundary with typecheck, lint, tests and a production build, plus a short report.

### Wave 1 — Lifecycle and access spine (additive)

- Forward-only migration: add `published_at`, `archived_at`; backfill (`scheduled`/`completed` before end+24h → published with `published_at = created_at`; past end+24h → also `archived_at = ends_at + 24h`); add partial indexes for public-active, archived, group+time, series+time.
- New pure helper `src/lib/events/lifecycle.ts`: `EventLifecycle` (draft/published/archived/canceled), `EventMoment` (upcoming/live/afterglow/archived), `interactionClosesAt = ends_at + 24h`, injectable `now`.
- New server module `src/lib/events/access.server.ts` returning the single `EventAccess` shape; every mutation and gated read consults it. No component recomputes permissions.
- `publishEvent` / `archiveEvent` / draft restore actions; publish validates title, kind, format, start, end > start, IANA timezone, venue for in-person, online link (or explicit "link coming soon") for online. Legacy `status = 'scheduled'` keeps being written for compatibility.
- Series: a published series stamps `published_at` on generated occurrences; draft series generate private drafts; `archived_at` is never copied.
- Default `promo_pass_months` to 0; keep admin opt-in.
- Bounded archival sweep reusing the existing authenticated sweep route — for indexing only, never for authorization.
- Admin composer copy → "Save draft" / "Publish Event". Regenerate database types.

### Wave 2 — RSVP, explicit check-in, privacy, RLS

- Server-authoritative RSVP: published, non-canceled, non-archived, before end, capacity/waitlist honored. Interface keeps only RSVP and Undo RSVP; `maybe` stays readable in storage but leaves the UI.
- Un-RSVP relocks participation immediately and clears a live `checked_in_at`, never deleting posts or photos; warn a checked-in viewer first.
- Delete `autoCheckInToEvent` and its effect. Add `checkInToEvent`: authenticated, event published and not canceled/deleted, `starts_at <= now <= ends_at`, RSVP exactly `going`, idempotent, explicit consent copy.
- Gate the roster, Wall, Gallery and person expansion behind confirmed RSVP / host / admin in both server functions and RLS.
- Split reads: public flyer DTO (no `online_url`, no protected coordinates) vs authenticated access DTO. Strip `online_url` from anonymous loaders, cards, peeks, public ICS, metadata and JSON-LD.
- Fix RLS: drafts never public, Wall readable by participants only, series templates not anonymously readable, storage policies aligned with the 24-hour cutoff.
- `EventLocationCard` switches from `!!user` to `canSeeOnlineUrl`.
- Role matrix checks: anonymous, signed-in stranger, waitlisted, confirmed, checked-in, host, admin.

### Wave 3 — The living-flyer route

- Refactor the canonical route in place: cover, status treatment (Upcoming / Happening now / Posting open for 24 hours / Archived / Canceled), title, tagline, host, date-time in Event timezone, format, share, QR/short link, calendar, report.
- Exactly four tabs: About, Who's here, Wall, Gallery, with `?tab=` persistence, locked tabs that fire no protected queries, and the specified default per viewer and moment.
- About absorbs Lineup, host updates and a small read-only Event stories subsection when posts exist; RSVP control is one primary action plus a quiet undo.
- Remove the companion panel, standalone attendee-work rail, showcase/projector and duplicate photo blocks from the route; leave underlying data and components intact until Wave 7.

### Wave 4 — Wall with images, Gallery as a projection

- Add nullable `comment_id` on `event_photos` (the minimal bridge).
- One domain action `createEventWallPost({ eventId, body?, photos? })`: text or at least one photo, trimmed ≤ 500 chars, ≤ 4 images, reuse `resizeImageToJpeg(file, 1500, 0.82)`, server-side MIME/dimension/storage-path/event-prefix validation, rate limit, RSVP + 24-hour checks.
- Direct Gallery uploads flow through the same action so an image exists once. Author delete, host/admin moderation, reporting, blocked users, upload progress, signed-URL refresh, accessible images.
- Replace the 3-day seal with `ends_at + 24h` everywhere including `is_event_wall_sealed()`; frozen stream renders read-only.

### Wave 5 — Who's here and person expansion

- Explicit Check in state and "Check-in opens when the Event begins" before start; "Who was here" after.
- RSVP-only checked-in roster, light polling while live and quiet afterwards.
- Lazy person sheet: identity, up to three In Progress Collabs (owner or accepted `collab_invites`), three published public Works via `work_credits` (creator fallback), three published posts via `blog_post_authors`. Respects blocks, discoverability, archived/visibility. Calm empty state.

### Wave 6 — Discovery, Groups, Homepage, archive

- Every consumer moves to the shared lifecycle/discovery layer: `/events`, cards and peeks, featured carousels, Group Events tab and next-Event module, Group Today rails, member and public Homepage, city strips, My RSVPs, short-link redirect, ICS, notification sweeps, Blog tagging, MCP search, sitemap.
- Active discovery uses `ends_at > now`, live before upcoming; the 24-hour afterglow stays reachable by URL, My RSVPs and Group context without crowding feeds.
- Group associations read `event_groups`; a series contributes only its nearest active occurrence, with an "Other dates" strip in About.
- Sitemap includes public Event URLs with a retention cap; Schema.org Event JSON-LD with Scheduled / Cancelled / Completed and no gated link.

### Wave 7 — Cleanup and proof

Remove dead imports and unused components after a repository-wide search, retire Scheduled/Live/Completed/Companion/Showcase/Projector/3-day language from the new experience, confirm no page-load mutation remains, verify narrow-mobile through desktop layout, and run the full suite.

## Tests

Vitest for the pure lifecycle helper and access resolution; server-function and RLS coverage for the full checklist in the brief — draft privacy, publish validation, anonymous DTO never containing `online_url`, RSVP intent surviving Google/Apple/email once, waitlist not unlocking, un-RSVP relocking without data loss, render-never-checks-in, check-in rejection cases, non-attendee direct requests, Wall validation and storage-path ownership, single photo record across Wall and Gallery, the exact 24-hour cutoff, archive read-only ahead of the sweep, live Events staying discoverable, occurrence isolation, person-expansion visibility rules, canceled behavior, no silent Plus, and clean public ICS/metadata/sitemap/JSON-LD.

## Assumptions

- Event creation stays admin-authorized as it is today; draft/publish controls live in the existing admin composer.
- Legacy enum values, `maybe` RSVPs, likes and thread columns remain in storage untouched; only the interface changes.
- No existing Event history is deleted in any wave.
