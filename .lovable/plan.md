# Event "Featuring" — optional per-occurrence lineup, starting with Open House

A small, optional block on an Event page that shows who is featured that night: avatar, name or project name, role, a short public blurb, and a Workshop profile link when one exists. Nothing about the Event model changes; an Event with no features looks exactly as it does today.

## Confirmed current state

- `src/routes/g.$slug.e.$eventSlug.tsx` renders one info card, then the RSVP block, then exactly four tabs (About, Who's here, Wall, Gallery). That structure stays.
- Open House occurrences are ordinary `group_events` rows tied to a `workshop_event_programs` record; `src/lib/events/workshop-programs.ts` materializes them.
- `/admin/open-house` reviews applications but cannot assign them to a specific night.
- `group_event_cohosts` grants management permissions, `event_showcase_items` is attendee-submitted, `featured_at` is homepage editorial — none of these get reused.
- The event page currently passes `hostless={Boolean(ev.workshop_venue_key)}` to the location card, which is the wrong signal; the row has a real `facilitation` column (`hosted` / `hostless`).
- Account lifecycle already runs post-auth work through `src/components/account-lifecycle/provider.tsx` + `src/lib/account-lifecycle.functions.ts` — the right place to hang an application claim.

## What gets built

### 1. Data model

New table `group_event_features`: event (required, cascades on event delete), optional profile link, required `display_name`, `role_label`, and `about` (max 600 chars), optional internal `open_house_application_id`, `sort_order`, timestamps + update trigger. Indexes on event, user, and application. A partial unique constraint stops the same application being booked twice onto the same occurrence, while still allowing one application across many nights.

Access: anyone who can see the Event can read the public feature fields; nobody but an admin can write them, enforced server-side. Being featured grants no hosting, editing, or moderation power. Application email, proposal, setup notes, admin notes, and the application id never reach the public payload.

### 2. Public query + block

A focused feature module returns only id, display name, role, about, sort order, and safe profile fields (id, username, display name, avatar) for one event, ordered by `sort_order` then creation time.

`src/components/events/event-featuring.tsx` renders a "Featuring" heading and one compact row per person — circular avatar (profile avatar, or initials when unlinked), name, role, blurb. Linked people get an accessible link to their profile; unlinked people get no link. Zero features renders nothing at all. Placed between the info card and the RSVP card, using existing tokens and card conventions.

### 3. Booking from the Open House admin

The application detail sheet gains an "Event bookings" section:

- **Book for Event** opens a dialog listing only upcoming, published, non-canceled Open House occurrences (joined through the program record with `program_type = 'open_house'`), sorted by date, each showing date, start time, and venue.
- The form prefills display name (project name, else contact name) and a role label derived from the partner type; profile links automatically when the application has an account. Admin edits display name, role, occurrence, and a required public "about" of at most 600 characters — the applicant's proposal is offered only as editable draft text, never auto-published.
- Applications without an account can still be booked; the dialog explains the public block will show the stored name and initials until a profile links up.
- Saving requires ticking a confirmation that the venue permits the proposed activity.
- On success: the feature row is created for that exact occurrence, linked to the application (and user when present), the application moves to `booked`, and the admin gets a link to the Event. If feature creation fails, the status is not changed.
- Existing bookings list date, title, role, with View / Edit / Remove. Remove confirms, deletes only that one relationship, leaves the application and other bookings intact, and does not invent new status transitions.
- Every create/edit/remove goes through the existing server-side admin check.

### 4. Application → account handoff

An idempotent server function, run through the existing post-auth lifecycle so it covers every sign-in method: take the verified email from the auth session, find unclaimed `open_house_applications` with a matching normalized email, and assign them to that user. Emails from URL params or client state are never trusted. Any already-created feature rows for those applications that still have no profile get attached to the new user, preserving the stored name, role, and about; an explicitly assigned different profile is never overwritten. Safe to re-run.

Signup copy on the Open House page is adjusted only if needed to say an account connects the application to their Workshop profile.

### 5. Hostless signal fix

The event page stops inferring hostless from `workshop_venue_key` and uses `facilitation === 'hostless'`. When booking an application whose partner type is `host`, the admin gets an explicit "this person is the formal host" option (defaulted on for host applications) that sets the occurrence's facilitation to hosted. Performers, vendors, artists, speakers, and sponsors never change facilitation and never get a cohost row. The Workshop venue disclaimer stays as is.

### 6. Materializer safety

The Open House occurrence materializer keeps its current behavior: it never touches feature rows, so top-ups and regeneration leave bookings alone and future occurrences never inherit them.

## Technical notes

- Migration: `public.group_event_features` following project ID/timestamp/FK conventions, with GRANTs, RLS enabled, a public SELECT policy gated on parent event visibility, and no non-admin write policies. Generated Supabase types refresh after the migration.
- New `src/lib/events/event-features.functions.ts` (public read + admin create/update/delete/list-by-application + eligible-occurrence query) using `requireSupabaseAuth` plus the existing `requireAdmin` pattern from `open-house-applications.functions.ts`.
- New `src/components/events/event-featuring.tsx`; single render site in `src/routes/g.$slug.e.$eventSlug.tsx`, loaded alongside the existing event query rather than by widening the main loader.
- Admin UI additions live inside `src/routes/admin.open-house.tsx`.
- Claim function added to `src/lib/account-lifecycle.functions.ts` and invoked from the provider's existing post-session effect chain.
- Verification after each phase: typecheck, tests, and a production build; final pass walks the acceptance list (four tabs unchanged, no leakage of application internals, no permission grants, per-occurrence isolation, duplicate prevention, idempotent claim).
