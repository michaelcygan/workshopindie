Make the circled parts of the consolidated RSVP card interactive.

1. Create a new `EventAttendeesSheet` component
   - File: `src/components/event-attendees-sheet.tsx`
   - Uses the existing `listAttendees` server function to fetch attendees for the event.
   - Opens as a bottom sheet (via `src/components/ui/sheet.tsx`) with a header showing the event’s RSVP counts.
   - Lists all attendees grouped by status: Going, Maybe, Waitlist.
   - Each list item shows an avatar + display name and is wrapped with the existing `ProfilePeek` component for hover/tap preview.
   - Clicking a name/avatar also navigates to the full profile.

2. Update `src/routes/g.$slug.e.$eventSlug.tsx` in the consolidated RSVP footer
   - Wrap each overlapping avatar in the “Who’s going” strip with `ProfilePeek` so users can hover (desktop) or tap (mobile) to preview the person.
   - Make the static `{going_count} going` text a trigger for the new `EventAttendeesSheet`.
   - Also make the `+N more` overflow indicator trigger the same attendee list.

3. Verify the result with TypeScript and a quick preview check on the event page.