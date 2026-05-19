## Goal

A dedicated `/gallery` page that's the "browse everything" surface — denser than the landing feed, with real filters, search, and a Following tab. Index page stays the curated welcome.

## New route: `src/routes/gallery.tsx`

Layout (top-down, calm and uncluttered):

1. **Slim page header** — `font-display` "Gallery" + one-line subtitle ("Everything people have shipped."). No hero.
2. **Sticky toolbar** (single row on desktop, stacked on mobile):
   - **Search input** (left, grows) — debounced 250ms, searches `title` + `excerpt` via `ilike`.
   - **Sort pill group** — Recent / Trending (existing pattern from index).
3. **Tabs row** — `For you` (default, all published) · `Following` (only when signed in).
4. **Filter chips row** (horizontal scroll on mobile, reuses `CategoryScroller`):
   - Category chips: All / Film / Music / Writing / Build / Visual.
   - Provider chips (second line, smaller, muted): All sources / YouTube / SoundCloud / Spotify / Vimeo / Bandcamp / Other. Driven by `embed_url` host match server-side via `ilike` on a small set of patterns; "Other" = no embed_url.
5. **Dense grid** — `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` with `gap-4`. Reuses `<WorkCard />`. Denser than index's max-4-col layout.
6. **Infinite scroll** — `useInfiniteQuery` with `IntersectionObserver` sentinel, page size 30. Skeleton tiles while loading next page.
7. **Empty state** — when filters yield nothing: "No works match. Try clearing filters." with a clear-all button. When Following + 0 follows: "Follow people to see their work here →" linking to `/` or a creator's profile.

URL state lives in search params so filters are shareable/back-button-safe:
`/gallery?q=&tab=for-you&cat=all&src=all&sort=recent`. Use TanStack Router's `validateSearch` with a Zod schema.

## Following tab

- Only renders when `useAuth()` has a user.
- Query joins `follows` (where `follower_user_id = me`) to `work_credits.user_id` to find works by followed creators. Done via a server fn `getFollowingWorks({ limit, cursor, filters })` because RLS-safe joining + DISTINCT works best server-side.
- Sort respected; category + provider + search filters apply.

## Server function: `src/lib/gallery.functions.ts`

Two exported server fns (both use `requireSupabaseAuth` only for the Following one; "for-you" can stay client-side using the publishable client since `works` is publicly readable):

- `listFollowingWorks({ limit, cursor, category, provider, sort, q })` — middleware: `requireSupabaseAuth`. Builds query against `works` joined to `work_credits` filtered by `user_id IN (select followed_user_id from follows where follower_user_id = auth.uid())`. Cursor = `(published_at, id)` keyset.

"For-you" fetch stays in the route file using the existing `supabase` client pattern from `index.tsx` for parity, extended with:
- `q` → `or(title.ilike.%q%,excerpt.ilike.%q%)`.
- `provider` → `ilike('embed_url', '%youtube.com%')` etc; "other" → `is('embed_url', null)`.
- keyset pagination via `lt('published_at', cursorTs)`.

## Nav wiring

- `src/components/top-nav.tsx` line 34: change `to="/"` Gallery link → `to="/gallery"`, drop `activeOptions={{ exact: true }}` (let prefix match).
- `src/components/mobile-nav.tsx`: the "Gallery" dock item currently points to `/` — repoint to `/gallery`. Home logo in top-nav stays `to="/"`.

## Index page cleanup (minimal)

Keep the curated `Works Gallery` section on `/` but:
- Trim from 24 → 12 items so it feels curated, not exhaustive.
- Add a "Browse the full Gallery →" link under it pointing to `/gallery` (preserving current category/sort as search params).

## Scaling considerations (build later, not now)

- Add a Postgres trigram index on `works.title` and `works.excerpt` when search volume justifies it.
- Add a generated `provider` column on `works` derived from `embed_url` + btree index, replacing the `ilike` filter.
- "Saved" tab (works you bookmarked via `work_reactions.reaction='save'`) — same shape as Following.
- City filter chip (works.city_id) — reuse `city-combobox`.
- Server-side faceted counts ("Film 142 · Music 89") — needs a materialized view; skip for v1.

## Out of scope (v1)

- Saved tab, city filter, faceted counts, "creators" tab, recommended-for-you ranking, tag filters.

## Files

**New**
- `src/routes/gallery.tsx`
- `src/lib/gallery.functions.ts`

**Edited**
- `src/components/top-nav.tsx` — repoint Gallery link
- `src/components/mobile-nav.tsx` — repoint Gallery dock item
- `src/routes/index.tsx` — trim count, add "Browse full Gallery →" link

## Technical notes

- Sticky toolbar: `sticky top-[64px] z-20 bg-background/85 backdrop-blur border-b border-border` (offset to clear top-nav).
- Debounce search with a small `useDebouncedValue` hook inline; no new dep.
- Infinite query key includes all filter params so changing any filter resets pages cleanly.
- Provider detection uses the same allowlist already in `src/components/embed-player.tsx` (`providerFromUrl`) for the chip → ilike map.
