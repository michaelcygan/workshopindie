## What the news ticker is

`GroupNewsTicker` (`src/components/group/group-news-ticker.tsx`) sits between the group hero and the tab bar on `/g/$slug`. It's a scrolling marquee pill with a "In the news" chip; clicking the chip opens a popover of headlines. Feed URL is stored per group in `groups.news_feed_url` and rendered by parsing RSS/Atom server-side.

Today the chain is:
1. Client component calls `useQuery(fetchGroupNews)` (a TanStack `createServerFn`).
2. `fetchGroupNews` reads `groups.news_feed_url` via `supabaseAdmin` (dynamic import), fetches the feed, regex-parses items, returns `{ items }`.
3. When `items.length === 0`, the component returns `null` — nothing renders.

## Root cause on production

I confirmed on the published site (`workshopindie.com/g/chicago`):

- Chicago's `news_feed_url` is set (Google News RSS query).
- The browser fires the server-fn request:
  `GET /_serverFn/97b29a…?payload=…` → **HTTP 200, `content-length: 0`, empty body**.
- Directly fetching the same Google News RSS from outside works (HTTP 200, ~29 KB).
- The component treats an empty response as `items = []` and returns `null`, so the ticker never appears.

So the pipeline is intact everywhere except the production TanStack server-fn response: the worker returns an empty 200 for `fetchGroupNews`. Preview works because it's a different deployment. This lines up with the earlier "publish once and the ticker appears in preview but not prod" symptom — the current published worker build simply isn't returning the JSON body for this fn.

## Fix — rebuild the news pipe on a simpler, cacheable primitive

Instead of another poke at server-fn encoding, replace the fragile server-fn hop with a plain public GET endpoint that returns JSON. This is what news feeds want anyway (CDN-cacheable, no auth, no per-user middleware).

### 1. New route: `src/routes/api/public/group-news.$slug.ts`

- `createFileRoute("/api/public/group-news/$slug")` with a `GET` handler.
- Look up the group by `slug` via `supabaseAdmin`, read `news_feed_url` and `id`.
- If no URL → return `{ items: [] }` with `Cache-Control: public, max-age=300`.
- Fetch the feed with the existing UA + 6s timeout, run the same RSS/Atom regex parser (extracted to a small helper). Cap items at 12.
- Return `Response.json({ items }, { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400" } })`.
- On fetch/parse error return `{ items: [] }` with a short cache so a bad feed doesn't hammer the origin.
- Uses `/api/public/*` so no auth middleware runs on published site.

### 2. Shrink `src/lib/group-news.functions.ts`

- Delete the server-fn `fetchGroupNews` (unused after this).
- Move the RSS/Atom parser + decode helper into `src/lib/group-news.ts` (pure, browser-safe) and re-use it inside the new route.

### 3. Rewire the component

`src/components/group/group-news-ticker.tsx`:

- Drop `useServerFn`/`fetchGroupNews`.
- `useQuery({ queryKey: ["group-news", slug], queryFn: () => fetch(\`/api/public/group-news/${slug}\`).then(r => r.json()), staleTime: 30*60*1000 })`.
- Take `slug` as a prop instead of `groupId` (matches the new endpoint and avoids a second lookup client-side).
- Same render logic, same "return null when empty".

### 4. Update the call site

`src/routes/g.$slug.tsx`: change `<GroupNewsTicker groupId={group.id} />` to `<GroupNewsTicker slug={group.slug} />`. No other consumers.

### 5. Verify

- After publish, curl `https://workshopindie.com/api/public/group-news/chicago` and confirm a non-empty `items` array + cache headers.
- Reload `/g/chicago` and confirm the pill renders and scrolls.
- If Google News is blocked from the Cloudflare Worker (empty items even from curl), swap the source to a workshop-hosted proxy or a different RSS aggregator — but I expect direct fetch to work; the current failure is at the server-fn transport, not at the RSS fetch.

## Files touched

- **New:** `src/routes/api/public/group-news.$slug.ts`
- **New:** `src/lib/group-news.ts` (shared parser)
- **Edited:** `src/components/group/group-news-ticker.tsx` (prop change + fetch)
- **Edited:** `src/routes/g.$slug.tsx` (prop change at call site)
- **Deleted:** `src/lib/group-news.functions.ts`

No DB migrations, no schema changes, no impact on any other flow.
