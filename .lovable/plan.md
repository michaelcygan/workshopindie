## Pass 12 — Group page polish + Today tab

### 1) Header polish (`src/components/group/group-hero.tsx`)

- **Avatar clipping**: the avatar sits at `-mt-10` over a hero band that fades to background. Against a light banner the white tile reads as "cut off". Fix by giving the tile a full opaque background ring and a soft drop-shadow that reads on any banner, and removing the dependence on the gradient fade for legibility. Specifically:
  - Drop the `border-4 border-background` ring (which causes the visible "bite" on a tinted banner) in favor of a `ring-4 ring-background` + `shadow-lift` combination that sits cleanly above the image.
  - Keep `-mt-10` but ensure the parent container has no `overflow-hidden`.
- **Title space**: the right column currently holds `GroupSparkBar + Share + Join` and steals horizontal room. Collapse to:
  - `Share` becomes an icon-only ghost button (already is).
  - `GroupSparkBar` moves into a small row under the meta chips (it's a sparkline, not a primary action) — frees ~120px.
  - Right column becomes just `[Share] [Join]`, both `size="sm"`.
  - Allow the title `h1` to use `text-balance` and bump its column to `min-w-0 flex-1`; remove `truncate` so a long name wraps to two lines instead of clipping with `…`.

### 2) Sticky tab bar overscroll (`src/components/group/group-tab-bar.tsx`)

The tab bar is `sticky top-14` but the **outer scroll container** (`overflow-x-auto`) is also the sticky element. On trackpads, vertical wheel deltas get consumed as horizontal scroll and the sticky element can be "pulled" out of place during rubber-band.

Fix:
- Split into two elements: outer `<div class="sticky top-14 …">` (no overflow) wrapping an inner `<div class="overflow-x-auto overscroll-x-contain">` for the tab list.
- Add `overscroll-behavior: contain` on the inner scroller so wheel/touch scroll doesn't bubble.
- Keep the trailing `Create` menu **outside** the horizontal scroller so it's always pinned right.

### 3) New **Today** tab

Add as the **leftmost** tab (default landing tab for groups). It uses primitives we already have — no new chat infra.

**Sections, top to bottom:**

a. **Today chat** — ephemeral group-scoped messages that auto-expire at local midnight.
  - New table `public.group_today_posts` with `group_id`, `author_id`, `body` (text, ≤500 chars), `created_at`, `expires_at` (timestamptz).
  - `expires_at` computed on insert from the author's `profiles.timezone` (fallback `UTC`): next local midnight → UTC.
  - RLS: SELECT where `expires_at > now()` AND group is public OR viewer is a member; INSERT requires membership + age-gate; DELETE own row or group admin.
  - `pg_cron` hourly: `DELETE FROM group_today_posts WHERE expires_at < now()`.
  - UI: simple composer (textarea + Post) + reverse-chrono list with avatar, name, relative time, delete-own. Realtime via existing supabase channel pattern.

b. **Today's collabs** — pulls from existing `collab_posts` joined to this group via `collab_groups`, ordered by `created_at desc`, filtered to `created_at >= today_start(viewer_tz)`. Reuses `CollabCard` (compact variant). Empty state CTA → `/collab/new?group=<slug>`.

c. **Happening today** — `group_events` where `starts_at::date = today(viewer_tz)`. Reuses existing event row component. Hidden if empty.

d. **Scene news** (optional, admin-configured) — if `groups.news_feed_url` is set (RSS or Google News URL), render up to 5 latest items.
  - Add `news_feed_url text` to `public.groups`.
  - Server fn `getGroupNews(slug)` fetches + parses RSS server-side, caches in-memory for 30 min. Returns `{title, link, published_at, source}[]`.
  - Admin edit dialog in `admin.groups.tsx` gets a "News feed URL" field.
  - Hidden entirely when unset (no empty state).

**Files:**
- New: `src/components/group/group-today-tab.tsx`, `src/components/group/today-composer.tsx`, `src/lib/group-today.functions.ts`, `src/lib/group-news.functions.ts`.
- Edit: `group-tab-bar.tsx` (add Today tab, make default), `g.$slug.tsx` (route Today tab, default state changes to `"today"`), `admin.groups.tsx` (news URL field).
- Migration: `group_today_posts` table + grants + RLS + cron unschedule/reschedule.

**v1 scope discipline:**
- No reactions, no replies, no mentions in Today chat. Just post + delete own.
- No image/file uploads in Today chat. Text only.
- News feed is admin-only to configure; no per-user RSS adds.
- Rate limit: reuse existing `check_and_bump` (10 posts / 60s / user / group).

### Out of scope (intentionally)
- Today across cities/parents (Today is per-group only for v1).
- Pin a Today post.
- Push/email notifications for Today chat.

### Technical notes
- Timezone: read `profiles.timezone` (already present per Pass 5 settings work). Fall back to `Intl.DateTimeFormat().resolvedOptions().timeZone` on the client for the *display* "today" boundary and to UTC server-side if profile tz is null.
- `today_start(tz)` helper sql function for clean date filtering in (b) and (c).
- RSS parsing: use a small, Worker-compatible parser (regex on `<item><title><link><pubDate>` is sufficient for RSS 2.0 / Atom for v1 — no node-only deps).
