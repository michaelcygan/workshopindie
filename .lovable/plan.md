## What's actually going on

The event page has a special filter no other surface uses: it only shows attendees whose profile has `event_visibility = 'public'`. Every profile in the database defaults to `'group_only'` and there is no UI to change it, so:

- Your own RSVP gets filtered out of "What people are working on" (that's why you don't see your own collabs/works).
- Other attendees never appear either.

You're right — event pages shouldn't have their own visibility class. They should inherit from the profile's normal discoverability (`profiles.discoverable`, which defaults to `true`), and privacy should be driven by **who is viewing**, not by a per-user event flag.

## Fix (three tight changes)

### 1. Stop using `event_visibility` — use `profiles.discoverable`

- `src/lib/group-events.functions.ts`
  - `attendeeUserIds()` (feeds `listEventAttendeeCollabs` / `listEventAttendeeWorks`): replace `.eq("event_visibility", "public")` with `.eq("discoverable", true)`. This makes your own RSVP + everyone else's flow through, matching how the profile appears everywhere else in the app.
  - `listAttendees()` (feeds "Who's going"): drop the `event_visibility` column from the select — nothing consumes it and its presence implies a special rule that shouldn't exist.
- `src/lib/event-companion.functions.ts` → `listCheckedInAttendees()`: same swap — filter on `discoverable`, not `event_visibility`.

Net effect for logged-in viewers: after RSVP, your collabs and works appear in "What people are working on", and so do everyone else's, exactly matching what those profiles show publicly elsewhere.

### 2. Hide people-surfaces from logged-out viewers on the event page

Logged-out visitors should see the event itself (SEO/share still works) but not the roster of who is going or what they're building. In `src/routes/g.$slug.e.$eventSlug.tsx`:

- Gate the **"Who's going"** card on `user` being signed in. When signed out, replace it with a lightweight summary (`{going_count} people going · Sign in to see who`) plus a "Sign in" link.
- Gate **`<EventAttendeeWork />`** on `user`. When signed out, replace with a small CTA card ("Sign in to see what people are bringing").
- The live-only `<EventCompanionPanel>` is already gated on `phase === "live" && isAttending`, so it's already private — no change needed.

### 3. Leave the moderation floor in place

Blocked-user filtering already runs inside `listAttendees` / attendee-work fetchers via the existing viewer-scoped logic — no change. RLS on `group_event_rsvps` / `profiles` is unchanged. The `event_visibility` column stays in the schema (inert) so we don't need a migration; it can be removed later if we want to.

## Not changed

- `profiles.event_visibility` column — left in place, just no longer read.
- Grants, RLS, and the RSVP flow itself.
- The event's public metadata (title, cover, time, location) — still visible to logged-out visitors for shareable links.