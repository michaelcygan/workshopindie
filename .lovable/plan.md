# Fix stale headlines in the news tickers

## What's actually wrong (verified)

The cache table backing both tickers has only two rows, and both are days old:

- `chicago` — last fetched Aug 12 (4 days ago)
- `soundcloud-rappers` — last fetched Aug 11 (6 days ago)

The reason is the refresh strategy. Both endpoints (`/api/public/group-news/$slug` and `/api/public/group-news-multi`) serve the cached snapshot immediately and kick off the upstream refresh as a fire-and-forget background task (`void (async () => ...)`). On the serverless runtime the request context ends as soon as the response is returned, so those background fetches are killed before they finish writing. Result: once a snapshot exists, it is served forever and never refreshed. Nothing is broken about the feeds themselves — the writes just never happen.

## The fix

1. **Add a scheduled warmer.** New public route `/api/public/group-news.refresh` that selects every group with a `news_feed_url`, refreshes any whose cached snapshot is older than the freshness window, and writes the results. Bounded (small concurrency, per-feed timeout already exists, cap per run) and it awaits its work, so writes actually land. It reports counts per outcome for debugging.
2. **Schedule it** with pg_cron every 15 minutes against the stable production URL.
3. **Make the request path self-healing.** In both endpoints, when a cached snapshot is stale, await the refresh with a short overall budget (~2.5s) instead of firing it into the void; if the budget elapses, fall back to serving the stale snapshot as it does now. This means a page view can repair the cache instead of relying only on cron, without ever slowing the ticker meaningfully.
4. **Surface staleness in the payload** (`ageMs` on the response) so this class of bug is visible next time rather than silent.

## Technical notes

- Files: `src/lib/group-news.server.ts` (add a shared `refreshIfStale` helper with the timeout budget), `src/routes/api/public/group-news.$slug.ts`, `src/routes/api/public/group-news-multi.ts`, new `src/routes/api/public/group-news.refresh.ts`.
- No schema change; `group_news_cache` already has `slug`, `items`, `fetched_at`.
- Cron insert done with the insert tool (contains the project URL and key), not a migration.
- Verification: hit the refresh endpoint once, then re-query `group_news_cache` and confirm `fetched_at` is current and row count matches the number of groups with feed URLs; then load the homepage and Groups ticker and confirm recent headlines.
