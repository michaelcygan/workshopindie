## Diagnosis (verified)
- Live `workshopindie.com/g/chicago` renders no `In the news` pill; the server call `GET /_serverFn/fetchGroupNews` returns **500** with worker log: `Error: Server function info not found for fetchGroupNews`.
- The Chicago group row in the database has a valid `news_feed_url` (Google News RSS), so data is not the issue.
- Preview shows the ticker because the current preview build contains `src/lib/group-news.functions.ts` and its registered server-function ID. The published worker is an older deploy that doesn't know that ID — hence the 500, and the component (`items.length === 0 → return null`) silently disappears.
- Your screenshot 2 shows the "Finish update" indicator, consistent with unpublished changes.

## Fix
1. Republish the project so the deployed worker includes `fetchGroupNews` (and any other newer server functions).
2. After the deploy finishes (~1 min), reload `workshopindie.com/g/chicago` and confirm the "In the news" pill appears with scrolling headlines.
3. If it still 500s after republishing, capture fresh worker logs for `fetchGroupNews` and investigate further — but this is not expected, since preview works with the same code.

## No code changes required
The ticker code, data, and RSS source are all correct. This is a deploy-lag issue, not a bug.
