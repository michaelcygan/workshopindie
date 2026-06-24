# Pass 11 — Events & Groups as the on-ramp (revised)

Revised per your feedback: keep RSVP simple, deprioritize "what the group produces" in favor of "what RSVP'd attendees bring," default group tab to Collabs, and add a real `/events` route.

## Changes

### A. Auto-join host group on RSVP `[HIGH]`
`src/lib/group-events.functions.ts` → in `rsvp`, when status is `going` or `maybe`, also insert into `group_members` (silent on duplicates, non-fatal on failure). No UI surface — just happens.

### B. Logged-out RSVP → account create → auto-join group `[HIGH]`
Already partially wired via `EventRsvpAuthSheet` + `usePendingRsvp`. Confirm the resume path runs `rsvp()` post-signup, which under change A also joins the group. No copy changes (per your "don't get too complex" note).

### C. Public `/events` index route `[HIGH]`
New `src/routes/events.index.tsx`:
- Server-loaded list of upcoming **public** events (next 60 days), online + in-person mixed
- Grouped by week
- SEO meta + `ItemList` JSON-LD + canonical
- Empty-state CTA → `/groups`
- Add `/events` to `sitemap[.]xml.ts` static paths
- The existing top-nav "More → Events" link is already there; point it at `/events`

### D. Event page: "Collabs from people going" rail `[HIGH]`
On `g.$slug.e.$eventSlug.tsx`, below RSVP, new component `<EventGoingCollabsRail eventId />`:
- Pull `collab_posts` where `created_by` is in the set of `going` RSVPs
- Filter to `status = 'open'`, latest 6
- Header: "Open collabs from people going"
- This is the real wedge — non-users see live opportunities tied to people who'll actually be in the room.

(Skipping the "what this scene produces" rail — you said it shouldn't outweigh attendee work. Attendee work rail already exists.)

### E. Default group tab → Collabs `[LOW]`
`g.$slug.tsx`: drop the `useEffect` + content-weighted `defaultTab` swap. Always default to `"collabs"`. Predictable URL, no flicker. Events get their own home at `/events` now.

### F. Hide dead "Request to host" copy `[LOW]`
`GroupEventsTab` → only render the host-affordance row when `isAdmin`.

## Files

**Edits**
- `src/lib/group-events.functions.ts` — auto-join group on RSVP
- `src/routes/g.$slug.e.$eventSlug.tsx` — mount `<EventGoingCollabsRail />`
- `src/routes/g.$slug.tsx` — default tab → collabs; hide dead host copy
- `src/routes/sitemap[.]xml.ts` — add `/events`
- `src/components/top-nav.tsx` — point "More → Events" at `/events` (if not already)

**New**
- `src/routes/events.index.tsx` — public events index (online + IRL)
- `src/components/event-going-collabs-rail.tsx` — collabs from RSVP'd attendees

## Explicitly skipped
- Stronger RSVP auth-sheet copy (keep current simple)
- "What this scene produces" rail (deprioritized vs. attendee collabs)
- Tab merge on event page
- Member-host event creation flow

~1 build turn. Approve and I'll ship A–F.
