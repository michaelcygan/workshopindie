# Fix the Group news ticker on production

## What I found (verified, not guessed)

I called the live endpoint on the real domain:

`GET https://workshopindie.com/api/public/group-news/chicago`
→ `200 {"items":[]}` with `Cache-Control: public, max-age=120, s-maxage=120`

That cache header is the fingerprint of one specific branch in the endpoint: the
`120`-second empty response is only returned when the **external RSS fetch fails**
(non-2xx, timeout, or network exception). The other branches use `60` (database
error) and `300` (no feed configured). So:

- Steps 1–6 of the pipeline are fine in production: routing works, the backend
  client initialises, Chicago is found, and `news_feed_url` is present.
- Supabase/env bindings are **not** the problem.
- Step 7 — the server fetching the Google News feed — is where it breaks.

Chicago's feed is a Google News search RSS URL with a long multi-term query. From
this sandbox that URL returns `200` and ~129 KB of valid RSS with both the bot
user-agent and a browser user-agent, so the feed itself is healthy. The failure is
specific to the production edge runtime — most likely the 6-second timeout against
a large slow response, or Google rate-limiting/blocking edge datacentre traffic.
Which of those it is cannot be determined without logging from production, so the
first wave makes that visible rather than guessing.

Both groups with feeds (Chicago, SoundCloud Rappers) use Google News search URLs,
so they share the same fate.

## The fix, in waves

### Wave 1 — Make the endpoint honest and observable
Rework `/api/public/group-news/$slug` so every outcome is distinct:

| Outcome | Status | Body | Cache |
| --- | --- | --- | --- |
| Headlines found | 200 | `{ items, reason: "ok" }` | existing 30 min + SWR |
| No feed configured | 200 | `{ items: [], reason: "no_feed" }` | 5 min |
| Group not found | 404 | `{ items: [], reason: "not_found" }` | 5 min |
| Feed returned no parseable items | 200 | `{ items: [], reason: "empty_feed" }` | 5 min |
| Config missing / database error | 500 | `{ items: [], reason: "config" \| "db_error" }` | `no-store` |
| Upstream non-2xx / timeout / network error | 502 | `{ items: [], reason: "upstream_status" \| "upstream_timeout" \| "upstream_error" }` | `no-store` |

Add concise one-line server logs (`[group-news] ...` with slug, hostname, status,
item count — never credentials, never feed bodies). Failures stop being
CDN-cached, so a repaired backend recovers immediately instead of staying broken
for 30 minutes.

Also harden the upstream request itself: raise the timeout to ~10s, follow
redirects, and send a browser-like `User-Agent` alongside the RSS accept header
(Google News is picky about unknown bots at scale).

### Wave 2 — Read the production logs
Deploy, hit the live endpoint again, and read the worker logs to see the exact
reason code. This is the step that names the true cause.

### Wave 3 — Fix the named cause
Depending on what Wave 2 reports:
- **Timeout** → longer budget already applied; confirm. If still slow, trim the
  request (Google News honours a smaller result set) and keep the successful
  response cached long enough that visitors rarely trigger a live fetch.
- **403/429 from Google** → the edge IP range is being blocked. Then the correct
  answer is server-side caching: store the last good parsed headlines for each
  feed and serve those, refreshing in the background. Scoped to a single small
  cache table, not a news subsystem.
- **Something else** → fix that specific thing.

No change is made to the parser unless the logs show a real format mismatch.

### Wave 4 — Client behaviour
In `group-news-ticker.tsx`, throw on non-2xx so React Query records a real
failure (visible in devtools/console for developers) instead of silently
converting everything to an empty list. The public UI is unchanged: no error
banner, ticker simply stays absent. Cache time stays as-is for success; failures
won't be retained because the query errors rather than caching an empty array.

### Wave 5 — Verify on the real domain
- `https://workshopindie.com/api/public/group-news/chicago` returns real
  headlines with `reason: "ok"`.
- `https://workshopindie.com/g/chicago` shows the ticker, logged out and logged
  in, desktop and mobile, across Today/Events/other tabs; links and the
  "In the news" popover work; no hydration or console errors; no horizontal
  overflow; reduced-motion fallback intact.
- A group with no feed (any group other than the two above) stays cleanly
  ticker-free with `reason: "no_feed"` and no error logged.

## Not doing
No redesign of the ticker, typography, spacing, animation, placement, popover, or
Group navigation. No new pages, widgets, iframes, client-side RSS fetching, or
service-role credentials. The persisted-ingestion architecture stays a future
option, used only if Wave 2 proves live fetching cannot work from production.
