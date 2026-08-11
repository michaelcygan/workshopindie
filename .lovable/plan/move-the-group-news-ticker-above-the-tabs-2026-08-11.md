# Move the group news ticker above the tabs

## What you're seeing

The screenshot is from the published site (workshopindie.com), which still serves the build from before the last ticker fix — that's the most likely reason the logged-in ticker is missing there. The current code renders the ticker inside the Today tab for both logged-out and logged-in visitors, so it also sits *below* the tab bar rather than above it, which is what the circle marks.

## The fix

Promote the ticker from a Today-tab element to a scene-level element on the group page:

1. Remove `GroupNewsTicker` from both branches of the Today tab.
2. Render it once on the group page, between the hero and the tab bar, so it appears above the tabs for everyone — logged out and logged in — and stays visible on every tab, not just Today.
3. Keep the existing tight mobile sizing (short pill, smaller type, tap-to-open headlines list) and the "render nothing when the group has no feed or no items" behavior.
4. Verify on a 390px viewport that the ticker sits directly under the hero row and above Today / Collabs / Events / Gallery, logged out and logged in.

Once merged, publishing is what makes it show up on workshopindie.com.

## Technical notes

- `src/components/group/group-today-tab.tsx` — drop both `<GroupNewsTicker slug={group.slug} />` usages.
- `src/routes/g.$slug.index.tsx` — render `<GroupNewsTicker slug={group.slug} />` inside the `space-y-2` block, after `<GroupHero />` and before the `px-4 md:px-6` wrapper that holds `GroupTabBar` (the ticker supplies its own horizontal padding).
- No changes to `src/components/group/group-news-ticker.tsx`, the `/api/public/group-news/$slug` endpoint, or the homepage ticker usage in `member-home.tsx`.
- No database or server changes.
