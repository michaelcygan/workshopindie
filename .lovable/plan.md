## Goal
Show an empty-state preview for the events section on `/` so we can see how it looks, and move it to the bottom of the homepage.

## Changes

### 1. `src/components/featured-events-carousel.tsx`
- Remove the early `return null` when there are no events and the viewer is not admin.
- Render a friendly empty-state card for **everyone** when `events.length === 0`:
  - Soft dashed-border card matching the existing "Post a Work / No open Collabs" empty states on the homepage.
  - Headline: "Live events are coming."
  - Sub: "Workshops, open mics, listening parties — RSVP unlocks a free Workshop Pass."
  - For admins: primary CTA button "Post the first event" → `/admin/events` (replaces the existing dashed card).
  - For everyone else: secondary link "Browse groups" → `/groups`.
- Keep the section header ("Featured events" + "RSVP unlocks free Workshop Pass") visible in both states.

### 2. `src/routes/index.tsx`
- Reorder the home sections so the events block is **last**:
  - Hero → YourGroupsStrip → NetworkRail → Works Gallery → CityMeetupsStrip → CollabsRail → **FeaturedEventsCarousel** → **UpcomingInMyGroupsRail**.
- `UpcomingInMyGroupsRail` keeps its own internal "hide when empty" behavior (it's signed-in-only and personalised), so it stays just below the featured block.

No schema, server-function, or business-logic changes.
