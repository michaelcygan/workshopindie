# Workshop Co-working

Co-working becomes a new Event kind inside the existing Event system — same records, routes, RSVP, check-in, Wall, Gallery, notifications, calendar export. No second event product.

What already exists and gets reused: `capacity + overflow` with a shared `maxRsvps` helper, the concurrency-safe `reserve_event_rsvp` reservation function, the Workshop venue registry keyed by `workshop_venue_key`, venue policy confirmation timestamps, event series keys, RSVP notes, check-in, and the pending-RSVP-after-signup flow.

## Wave 1 — Kind + data model

- Add `coworking` to the event kind enum, labelled "Co-working" everywhere (admin composer, filters, cards, badges, structured data, notifications, analytics).
- Move the venue registry into a real `event_venues` table (seeded idempotently from the existing code registry, keyed by the same keys so current events keep working) with policy metadata: status (Active / Scout later / Inactive), co-working and Open House eligibility, reservation and seating policy, walk-in group threshold and whether it is hard/soft/unknown, wifi, power, dayparts, allowed activities, purchase expectation, food, indoor/outdoor, accessibility, age rules incl. time-based, conflicts, source URL, verification date, internal notes.
- Add to `group_events`: `daypart`, `min_age`, `facilitation` (default hostless), `drop_in_allowed`, `allowed_activities`, `arrival_note_public`, `admin_note`, `preflight_status`, `venue_id` reference (snapshot fields stay authoritative), and a small typed `coworking` config for presentation-only details.
- Grants + RLS: admins/event managers write; public reads a safe venue projection; internal notes admin-only; users write only their own RSVP/check-in notes.

## Wave 2 — Capacity, age, RSVP

- Single source of truth for max = capacity + overflow, in one SQL helper and one TS helper; every "full"/waitlist comparison uses it. Overflow 0 behaves exactly as today. Lineup capacity and venue thresholds stay separate.
- Publishing blocks when max exceeds a hard venue threshold; warns when soft or unknown.
- Server-side minimum-age gate in the RSVP reservation path using existing private age data; never expose birth dates. 21+ badge on card, RSVP block, and venue info.
- Co-working RSVP: no plus-ones, one per account, waitlist past max, existing automatic promotion. Adds the no-reservation line under the controls and an optional 120-char "What are you working on?" note visible only to accepted attendees.
- Admin cards show Expected / Overflow / Maximum; public cards never show "8 / 6".

## Wave 3 — Creation and rotation

- The existing New Event form gains conditional Co-working fields and defaults (in person, Workshop source, official, waitlist on, 2 hours, hostless, public location, city group, title/tagline/description templates, daypart presets 6+3 / 6+3 / 6+2 with venue overrides).
- New admin-only "New Co-working rotation" action in /admin/events: city, start week, 3/6/9/12 sessions, weekly, Morning → Afternoon → Evening rotation, daypart-filtered venue suggestions, per-row editing, conflict/duplicate/threshold validation, drafts first, publish one or all. Each occurrence is an ordinary event with its own slug, RSVPs, Wall, and notifications, sharing a fixed-rotation series identity that the existing recurrence worker will not clone. Chicago template offered as editable starting rows, never auto-published.

## Wave 4 — Public surfaces

- `/events?kind=coworking` plus an optional daypart filter, without disturbing existing filters; cards gain Co-working, daypart, hostless, and 21+ signals.
- Event page: "Quiet working session" block before RSVP (activities, hostless, drop-in, purchase, first-come seating, wifi/power, min age, contained-art limits), a four-line "How it works", and the required public notice about ordinary public seating and no reserved table — always visible.
- Host presentation for Co-working reads "Organized by Workshop · Hostless session" with the venue labelled "Meeting place". Never partner/host language.
- Live occurrences default to the "Who's here" tab (Co-working only), with an optional 80-char seating note during check-in, visible to accepted attendees and hidden after the afterglow window.
- Wall composer placeholder and post-session "What did you move forward?" prompt reusing the existing Work / Blog connection flows.

## Wave 5 — Ops, notifications, tests

- Co-working reminder/recap copy variants on the existing scheduler, dedup and preferences untouched.
- Venue preflight status surfaced in admin within the week before a session: saved hours, conflicts, age rule, verification date, source link.
- Admin event list gains Co-working edit plus RSVP / check-in / attendance-rate / waitlist / venue / daypart columns using the existing tables.
- Analytics events for view, RSVP, waitlist, cancel, promotion, check-in, notes, work connected — with venue, daypart, series.
- Tests: capacity/overflow and waitlist promotion, hard-threshold publish block, age gate, rotation generation ordering and non-cloning, daypart filtering, and regression coverage for existing kinds.

## Venue pool seeded

Active: Begyle (morning flagship), Long Room, Off Color Mousetrap (home base), Solemn Oath / Still Life, Goose Island Fulton, District Brew Yards (21+), Half Acre Balmoral, Life on Marz, Marz Mothership, Waterfront Café. Obama Presidential Center Café is seeded as "Scout later", excluded from rotation, with the internal note about it being too busy. All fields remain admin-editable.
