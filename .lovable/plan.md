The Activity tab duplicates the "What people are working on" section that already appears above the tabs. We will remove the tab entirely and keep the existing section as the single source of truth.

### What we'll change

1. **Remove the Activity tab from `src/routes/g.$slug.e.$eventSlug.tsx`**
   - Delete the `<TabsTrigger value="activity">…</TabsTrigger>`.
   - Delete the `<TabsContent value="activity">…</TabsContent>` block and its `EventShowcaseStrip` usage.
   - Remove the `EventShowcaseStrip` import (the component file is still used by the live companion panel, so we won't delete it).
   - Adjust the grid columns on `TabsList` from `grid-cols-3`/`grid-cols-4` to `grid-cols-2`/`grid-cols-3`.

2. **Keep the existing "What people are working on" section**
   - This section already covers both open collabs and recent work from attendees, so no content is lost.

3. **No backend changes**
   - The `event_showcase_items` table and related server functions can stay; they support the live companion panel. We are only changing the public event page UI.

### Result

- Event pages will have About, Lineup (when applicable), and Wall tabs.
- The "Bring something" action disappears from the public page, matching the user's choice to remove the whole concept from this view.