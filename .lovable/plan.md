Move the profile Follow button below the cover on mobile so it no longer overlaps the header image, and align it horizontally with the user's name.

Current layout: the avatar + action-buttons row uses `-mt-8` on mobile, so the Follow button sits on top of the cover image. The identity block (name, @handle, city) sits below it.

Change plan:

1. In `src/routes/u.$username.tsx`, restructure the mobile header so:
   - The avatar still overlaps the bottom of the cover (kept as-is).
   - The action buttons move below the cover on viewports below `md`, sitting in the same horizontal band as the name.
   - Desktop layout stays unchanged (`md:` rules).

2. Implementation approach:
   - Render the Follow + Message + Share/Report/Block buttons in a mobile-only row directly under the avatar, before the identity block.
   - Hide the mobile buttons on `md:` and keep the existing desktop action-buttons row visible only on `md:`.
   - On mobile, place the Follow button in a flex row with the name so it aligns to the right of the name while the rest of the metadata flows below.

3. Verify visually in the mobile preview that the Follow button is no longer on the cover and sits roughly at the same vertical level as the name.

No backend, schema, or behavior changes.