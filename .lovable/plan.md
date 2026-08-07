# Homepage news ticker, aggregated across your Groups

Reuse the existing Group ticker primitive and feed it items from every Group the signed-in member belongs to.

## What exists today (verified)

- `GroupNewsTicker({ slug })` — the pill ticker: marquee, hover-pause, reduced-motion fallback, "In the news" popover, React Query with `staleTime: 30m` and `retry: 1`, hides itself when there are zero items.
- `/api/public/group-news/$slug` — server route that reads `groups.news_feed_url`, serves a fresh snapshot from the `group_news_cache` table (< 20 min old) without touching upstream, otherwise fetches the RSS with retries/timeout, parses via `src/lib/group-news.ts`, upserts the cache, and falls back to stale cache on failure. Cache headers differ per outcome.
- The member home payload already includes `nowGroups` (id, name, slug) for **all** the viewer's `group_members` rows — no new membership query needed.

## The change

1. **New aggregate endpoint** `/api/public/group-news` accepting `?slugs=a,b,c` (capped at ~12 slugs). It reads `group_news_cache` for those slugs in **one** query (`.in("slug", slugs)`), merges the items, tags each with its group name/slug (one `groups` select for names + feed URLs), sorts newest-first, and caps at 18. Only when a member's group has a feed URL but no fresh cache row does it refresh upstream — capped at 2 refreshes per request so a slow RSS host can never slow the homepage. Same JSON shape, same cache-header strategy, same "never cache failures" rule.
2. **Lightly generalize the component.** `GroupNewsTicker` keeps working with `slug`; it gains an optional `slugs` prop (aggregate mode) and each item may carry an optional `groupName`/`groupSlug`. When present, the marquee and popover render a small uppercase source label before the headline (`FILMMAKERS · Open call for shorts…`), styled with the existing muted label type — no new borders or cards. Single-group mode renders exactly as it does now.
3. **Homepage placement.** In `MemberHome`, render the ticker just above the Now board, passing `data.nowGroups.map(g => g.slug)`. Renders nothing when the member has no groups or when no items come back — no empty shell, no skeleton (avoids layout jump; the pill simply appears). Logged-out home untouched.

## Notes

- No new tables, no new membership queries, no feed, no ranking.
- Group label click goes to `/g/$slug`; headline links keep `target="_blank" rel="noopener noreferrer ugc"`.
- Verification: typecheck plus a mobile-viewport pass at 390px checking no horizontal overflow, readable labels, and working links.
