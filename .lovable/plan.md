## Audit findings

**The event flow is wired up correctly** — `FeaturedEventsCarousel` is mounted on `/` (line 194) and `/groups`, the `/me/tickets` link is in both top nav and mobile nav, the `events-sweep-5min` pg_cron job is active, grants and RLS are correct, and `/g/$slug/e/$eventSlug` renders. The reason you see no promotion on the homepage is simpler than a bug:

1. **There are zero rows in `group_events`.** Nothing has been created yet (admin or otherwise).
2. **The carousel returns `null` when empty** — so the homepage shows nothing at all instead of a "coming soon" affordance.
3. **`listUpcomingForMyGroups` is defined but never rendered anywhere** — members of a group don't see upcoming events on the home page even when events exist.
4. **No empty-state CTA for admins.** As an admin browsing `/`, there's no nudge to go create the first event at `/admin/events`.
5. **Group profile "Events" tab is the only per-group surface.** The group header/about doesn't show a "Next event" pill, so casual visitors miss it.

## Fix pass (UI/surfacing only, no schema changes)

### 1. Seed the first events
Open `/admin/events` and create 2-3 real launch events with `featured_at` set, so the carousels populate. (You said you'd seed as admin first — this is the step that actually makes the flow visible.) No code change required; just confirms the pipeline works end-to-end.

### 2. Homepage: add an "Upcoming in your groups" rail
New component `UpcomingInMyGroupsRail` that calls `listUpcomingForMyGroups` and renders an `EventCard` row. Mount on `/` directly under `FeaturedEventsCarousel`, only visible when the viewer is signed in and the query returns ≥1 row. Reuses existing `EventCard`.

### 3. Empty-state for featured carousel
Update `FeaturedEventsCarousel` so that when `data.length === 0`:
- **Admin viewer**: show a dashed "Post the first Workshop event →" card linking to `/admin/events`.
- **Everyone else**: render nothing (current behavior).

This makes the surface discoverable for you while seeding, without showing an empty section to regular users.

### 4. Group profile: "Next event" pill in header
On `/g/$slug`, add a small pill in the group header ("Sat Jul 12 · Open mic →") when the group has an upcoming event, linking straight to the event page. Pulls from the existing `listGroupEvents` query already used by the Events tab — no new fetch.

### 5. Notifications bell empty hint (optional polish)
When `event_new_in_my_group` notifications exist but the user has no upcoming RSVPs, the bell already routes them correctly — no change needed. Noted as already-working.

### Technical notes
- All changes are presentation-layer. No migrations, no server-function changes, no RLS edits.
- Files touched: `src/components/featured-events-carousel.tsx`, `src/routes/index.tsx`, `src/routes/g.$slug.tsx`, plus a new `src/components/upcoming-in-my-groups-rail.tsx`.
- After shipping, the homepage will surface events for both logged-out (featured) and logged-in members (your groups), and admins will always see a path to create more.

Want me to ship steps 2-4 now? (Step 1 is yours to do in the admin UI.)