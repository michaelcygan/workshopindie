# Event host line: credit the real organizer, not the city group

## What's wrong today

The event page already knows how to say "Hosted by TBD Comedy" — it does that whenever the event has an external organizer recorded. Two things break it for this event:

1. **The recurring copies lost the organizer.** The original listing (`tbd-comedy-open-mic`) is marked external with organizer "TBD Comedy" and an Instagram link. Every repeat occurrence generated afterwards (`-1` through `-9`, including the one you're looking at) has no organizer, no link, and is marked as a Workshop event. The stored recurrence template for this series simply doesn't carry those three fields, so each new week is created without them.
2. **The fallback is wrong.** When no organizer is recorded, the page falls back to the hosting Group — which for a seeded city listing is "Chicago". A city Group is a shelf, not a host.

## What changes

**Host line logic (event page, event cards, share/preview images)** — one shared helper so every surface agrees:

- If an organizer is recorded → "Hosted by {organizer}" (linked to their URL when present).
- Else if the hosting Group is a real community/member Group → "Hosted by {Group name}" with its avatar, as today.
- Else (hosting Group is a system city Group, i.e. a seeded listing) → fall back to the event's own name: "Hosted by TBD Comedy Open Mic".
- "Listed in Chicago" stays exactly where it is — that's the shelf, and it still reads correctly.

**Carry the organizer through recurrence** — when a repeating event is created or edited, the organizer name, organizer link, and external/Workshop source are stored in the series template so every future week keeps the credit.

**Backfill this series** — copy TBD Comedy's organizer, link, and external source onto the existing series template and its already-generated occurrences, so the current pages read correctly immediately.

## Technical notes

- New helper `src/lib/events/host-label.ts`: `resolveEventHost({ external_organizer, external_url, title, group })` returning `{ label, href, kind }`. System city Groups are detected via `groups.kind = 'city'` / `system_type`, so the host select in `src/routes/g.$slug.e.$eventSlug.tsx`, `src/lib/events/discovery.server.ts`, `src/routes/g.$slug.index.tsx`, and `src/components/event-card.tsx` picks up `group.kind`.
- Consumers updated: event detail header (lines ~276–312 of `g.$slug.e.$eventSlug.tsx`), `event-card.tsx`, `event-peek.tsx`, and `src/routes/api/public/og.ts`.
- `src/lib/group-events-admin.functions.ts`: template build already spreads `rest`, but the create path for legacy/backfilled series does not — explicitly persist `source`, `external_url`, `external_organizer` into `template` (they are already in `TEMPLATE_COLUMNS` in `event-series.server.ts`, so the materializer will copy them once present).
- One data migration: update the `event_series` template for series `legacy-cf419709-…` and the nine `group_events` rows with `slug like 'tbd-comedy-open-mic-%'` to set `source='external'`, `external_organizer='TBD Comedy'`, `external_url='https://www.instagram.com/tbd.comedy/'`.
- No schema changes; no change to RSVP, tabs, or the "Listed in" row.
