# Make Events public in navigation

Events pages are already readable by signed-out visitors — the events tables allow public reads, and neither `/events` nor the event detail route requires a session. The only thing hiding Events from logged-out people is the top navigation, which renders the Events link only when a user is signed in.

## What changes

1. **Desktop top nav**: show the same five links — Blog, Groups, Collabs, Gallery, Events — in both the logged-out and logged-in states. Nothing else about the header changes (Sign in / Join stay on the right when logged out; Create / avatar / bell stay when logged in).

2. **Mobile**: the bottom action island only renders for signed-in users, so logged-out mobile visitors get Events through the same path as the other sections — no new element added there. Events remains reachable from the footer link and any in-page links.

3. **Signed-out event pages**: verify the events list and an event detail page render for a logged-out visitor, and that RSVP / wall actions prompt sign-in rather than erroring. Fix only what breaks in that pass.

## Technical notes

- `src/components/top-nav.tsx`: remove the `user ?` conditional around the `/events` link so it renders alongside the other nav links.
- Confirmed already public: `group_events`, `event_groups`, `groups` have public SELECT policies and anon table grants; `src/routes/events.index.tsx` and `src/routes/g.$slug.e.$eventSlug.tsx` have no auth guard or protected loader.
