# Add to calendar — audit and refinement

## What the audit found

The architecture is right: one plain link on the event page pointing at a public `.ics` endpoint. No JavaScript interception, no picker, no OAuth. Keep all of that.

But the feature is currently broken and leaks private data:

1. **It returns 404 for every event, in production.** Verified against a real published Chicago event on the live site. The endpoint's database read joins the event to its group ambiguously — there are two paths between events and groups (the owning group, and the cross-listing table) — so the database rejects the query and the route falls through to "Not found". No one has been able to add a Workshop event to their calendar.
2. **The private join link can leak.** The query selects `online_url`, uses it as the calendar `URL:` field, and falls back to it for `LOCATION:` when there's no venue. The event page hides that link behind RSVP permission; the anonymous calendar endpoint does not.
3. **The calendar file never links back to Workshop.** There is no canonical event URL in the file.
4. **Escaping and folding are incomplete.** Backslash/comma/semicolon/newline handling misses carriage returns, and there is no RFC 5545 line folding, so a long title or description can produce a file some calendars reject.
5. **Canceled events look normal** in the calendar file — no cancellation signal.

Two things that are already correct and will not change: draft, group-only and unlisted events are already invisible to the anonymous endpoint through Workshop's existing access rules (the endpoint reads as a signed-out visitor), and recurring events are stored as individual occurrences, so one tap adds one occurrence.

## What will change

### Wave 1 — Fix the broken read
Make the group join explicit so the query resolves, and select only public fields. Confirm a real event now returns a calendar file instead of 404.

### Wave 2 — Remove the private meeting link
Stop selecting `online_url` in the public endpoint entirely. Location becomes:
- In-person / hybrid: venue name and address
- Online: `Online — RSVP on Workshop for the link`

### Wave 3 — Canonical Workshop URL
Every calendar entry carries `URL:https://workshopindie.com/g/{group}/e/{event}` and repeats it at the end of the description as "View on Workshop: …", so the calendar copy always points back to the live page for updates, join links and cancellations.

### Wave 4 — A small, reusable ICS helper
One local module for calendar formatting: text escaping (backslash, comma, semicolon, newline, carriage return, control characters), UTC timestamp formatting, RFC 5545 75-octet line folding, and file-name sanitising. Unit tests cover escaping, folding and a full generated file. No new dependency.

### Wave 5 — Lifecycle correctness
- Canceled events emit `STATUS:CANCELLED` (and are still downloadable, matching the page).
- Deleted or inaccessible events return 404 (already the behaviour; will be re-verified).
- Events with no explicit end use Workshop's existing 4-hour default rather than emitting an invalid empty end.

### Wave 6 — Headers and the link
Keep `Content-Type: text/calendar; charset=utf-8` and add a sanitised `Content-Disposition` filename like `workshop-open-mic.ics`. The frontend stays a plain anchor — no `target="_blank"`, no `download`, no blob, no `window.open`. Only change: a slightly larger tap target on mobile, same subtle text styling, still secondary to RSVP.

### Wave 7 — Verification
Fetch the real generated file for an in-person, an online, and a canceled event; validate the structure line by line; confirm no meeting URL appears anywhere; confirm headers. Cross-platform behaviour follows from a valid file plus correct headers, which is exactly what the standard handoff on iOS, Android, macOS and Windows relies on.

## Out of scope (explicitly not building)
Calendar provider menus, OAuth, permissions, subscription feeds, `RRULE`, "add whole series", user-agent routing, client-side blob generation.

## Technical notes
- `src/routes/api/public/events.$id.ics.ts`: disambiguate the embed to `groups!group_events_group_id_fkey`, drop `online_url` from the select, add `status`, `format`, `timezone`.
- New `src/lib/events/ics.ts` + `ics.test.ts`: `escapeIcsText`, `foldIcsLine`, `icsUtcStamp`, `buildIcsFile`, `icsFilename`.
- Reuse `eventEndsAt` and `getEventLifecycle` from `src/lib/events/lifecycle.ts` — no separate calendar lifecycle logic.
- UID stays `{event-id}@workshopindie.com`.
- `src/routes/g.$slug.e.$eventSlug.tsx`: touch only the anchor's padding/hit area; RSVP and event logic untouched.
