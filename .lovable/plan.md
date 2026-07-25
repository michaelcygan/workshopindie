Add a "Posts" chip to the profile stats row (both the desktop `ProfileStats` chips and the mobile stats strip) that appears only when the profile has published blog posts. Clicking it switches to the existing Blog tab.

## Changes

**`src/routes/u.$username.tsx`**
- Pass `blogCount` into `ProfileStats` and the mobile `Stat` strip.
- In `ProfileStats.items`, append `{ label: "Posts", value: blogCount, tab: "blog" }` when `blogCount > 0` — so profiles with no posts keep the current 4-chip layout unchanged.
- In the mobile stats strip (below the portfolio), conditionally render `<Stat label="Posts" value={blogCount} />` when `blogCount > 0`. Mobile `Stat` is text-only, so no navigation change there (matches current behavior for the other mobile stats).

No new queries — `blogCount` is already resolved from `loaderData.seo.published_blog_count` and gates the Blog tab today.