Wave 5 is done. Here is Wave 6.

# Wave 6 — Evaluate Group Posts

## Findings (verified this turn)

"Group Posts" is not a content type. There is **no `group_posts` table** — nothing to delete and no records to migrate. The name currently covers two unrelated things:

| Surface | What it actually is | Backing data | Production usage |
| --- | --- | --- | --- |
| Group **Posts** tab (`?t=posts` on `/g/$slug`) | A derived list of *published Blog posts* authored by anyone in `group_members`, rendered by `GroupPostsTab` → `LoungePosts` (the same component the Lounge uses) | `blog_posts` via `listPostsByAuthors` | 111 published blog posts exist platform-wide; the tab shows a member-filtered slice |
| Group **Today** board | Ephemeral chat/board messages with `expires_at` | `group_today_posts` | **0 rows**, 0 rows in the last 30 days, 0 pins, 0 groups with any post |

Other dependency checks:
- Notifications: none reference the Posts tab. `group_today_posts` only feeds the activity ticker (`groups-activity-ticker.tsx`) and the Today tab.
- Moderation: the `enforce_moderation_group_today_posts` trigger guards Today writes and stays untouched (Core memory rule).
- Search/feeds: the Posts tab is not indexed or fed anywhere else.
- `blog_post_entity_tags` has **0 rows total** (0 group tags), so the "From the Blog" module (`EntityBlogPosts`) already mounted on the same Group page at line 373 renders nothing today.

### Verdict

Group Posts has **no distinct product purpose**. Long-form publishing is Blog; ephemeral conversation is Today; creative output is Works; opportunities are Collabs; scheduled activity is Events. What the tab *does* add is a useful lens — "what have people in this Group published" — but it duplicates the Blog module already on the page and, worse, ignores posts explicitly tagged to the Group.

So this is a **consolidation, not a retirement**: one Blog surface per Group instead of two half-surfaces, and no data change.

## Changes

**1. One Group blog surface.** `GroupPostsTab` becomes a real component instead of a Lounge re-skin: it merges two sources, de-duplicated by post id, newest first —
- posts tagged to this Group via `blog_post_entity_tags.group_id` (`listBlogPostsForEntity`), shown first and marked "About this Group";
- posts authored by current group members (`listPostsByAuthors`, existing behavior).

**2. Rename the tab to "Blog"** in `src/routes/g.$slug.index.tsx`. The tab *value* stays `posts` so existing `?t=posts` links keep working; only the label changes.

**3. Drop the duplicate module.** Remove the standalone `<EntityBlogPosts kind="group" …>` at the bottom of the Group page — its content now lives inside the tab.

**4. Hide the tab when there is nothing to show.** Groups with no member-authored and no tagged posts no longer render an empty tab; the tab list is computed from a lightweight count query. If someone lands on `?t=posts` for an empty Group, it falls back to Today.

**5. Leave Today alone.** `group_today_posts` keeps its table, trigger, RLS, ticker, and expiry sweep. It is empty because it is ephemeral by design, not because it is dead — retiring it is not part of this wave.

## Database changes

None.

## Acceptance criteria

- A Group shows exactly one blog surface, labelled "Blog", containing both Group-tagged and member-authored posts with no duplicates.
- `?t=posts` deep links still resolve.
- Groups with no relevant posts show no Blog tab and no empty module.
- Today, its moderation trigger, and the activity ticker are unchanged.
- No table, column, policy, or row is modified.
- `tsgo` typecheck clean.

## Verification

Typecheck, then a Playwright pass over a Group page: default Today tab, the Blog tab (member-authored posts render, peek modal opens), a Group expected to have no posts (tab absent, `?t=posts` falls back), and console clean. Because `blog_post_entity_tags` is empty, the tagged-posts branch is verified by a temporary local tag in a scratch check rather than a production write.

## Risks and rollback

Low. The only behavioral risk is hiding the tab for a Group that does have posts — mitigated by driving visibility off the same queries that populate the tab. No migration, so rollback is a code revert.

## Deferred

Any decision about retiring `group_today_posts` itself, and backfilling Group tags onto existing blog posts, move to Wave 9 alongside the other schema work.
