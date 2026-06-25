Three targeted fixes for the group page Today tab + hero.

## 1. "Fresh collabs" → pinned + recent board

Rebuild the right-rail module as a user-curated daily board.

- **DB**: new `group_today_pins` table — `(group_id, user_id, collab_id, created_at)` with PK `(group_id, user_id, collab_id)`. Auto-expires at the pinner's local midnight via the same `tg_*_set_expiry` pattern as `group_today_posts` (reads `profiles.timezone`, sets `expires_at`). RLS: anyone in the group can read; only the pinner can insert/delete their own pin. Hourly `pg_cron` job (or reuse existing sweep) deletes expired rows.
- **UI** (`group-today-tab.tsx` → replace `FreshCollabs`):
  - Header: "Fresh collabs" + small `＋ Pin` button (members only).
  - **Pinned today** section: avatar + collab title + tiny "by @user". Owner sees an `✕` to unpin.
  - Divider, then **Recent** section: existing 24h `group_collabs` query, capped at 5.
  - Empty state: "Pin one of your collabs so the group sees it today."
  - Pin picker: lightweight modal querying the viewer's open `collab_posts` (status=`open`, ordered by `created_at`) with a search input filtering client-side. Insert into `group_today_pins`; on success also ensure the collab is in `group_collabs` for this group (idempotent upsert).
- Realtime: subscribe to `group_today_pins` filter `group_id=eq.<id>` alongside the existing channel.

## 2. Avatar clipping — actual fix

The 2nd screenshot shows the avatar tile being visually covered by the hero's bottom-fade gradient because the avatar (`-mt-10`) sits inside the hero overlay's paint region without an explicit stacking context.

Fix in `group-hero.tsx`:
- Wrap the title block in `relative z-10` so it forms its own stacking context above the hero overlay.
- Give the avatar tile `relative isolate` so its ring + bg paint cleanly over the gradient regardless of sibling order.
- Drop the placeholder `Icon` from inside the rounded tile (it reads as a clipped face). Replace with the group's first initial in `font-display` when no `avatar_url`.

## 3. Setting the RSS URL + ticker placement

**Where the URL is configured today**: only `/admin/groups` (admin-only). Add a second entry point for the group's own owners/admins:

- New "News feed" row in the **About** tab's edit panel (visible to anyone with `groups.owner_id = auth.uid()` or `group_members.role in ('owner','admin')`). Single text input → calls existing `updateGroup` server fn with `news_feed_url`. Helper copy: "Paste a Google News RSS URL (news.google.com/rss/search?q=…) — text headlines only, refreshed hourly."

**Ticker placement**: replace the right-rail `TodayNews` card with a **horizontal marquee ticker** rendered *between* the hero and the tab bar (full-bleed inside `max-w-7xl`, just above `GroupTabBar`). New component `GroupNewsTicker`:
- Uses `fetchGroupNews` (already cached 30 min).
- Single line, `overflow-hidden`, CSS `@keyframes` linear scroll, pauses on hover.
- Each item: `Newspaper` icon + headline as an external `<a>`; items separated by a `·`.
- Hidden entirely when the feed returns no items or no URL is set (so non-configured groups see nothing).
- `prefers-reduced-motion`: render as a static horizontally-scrollable strip with no animation.

Remove the `TodayNews` card from the Today tab's right column (the ticker replaces it everywhere on the group page, not just on Today).

## Files

- migration: `group_today_pins` table + trigger + cron
- `src/components/group/group-today-tab.tsx` — replace `FreshCollabs`, drop `TodayNews`
- `src/components/group/group-today-pin-picker.tsx` — new modal
- `src/components/group/group-news-ticker.tsx` — new
- `src/components/group/group-hero.tsx` — stacking + initial fallback
- `src/routes/g.$slug.tsx` — mount `<GroupNewsTicker groupId=… />` between hero and tab bar
- `src/routes/g.$slug.tsx` (About tab) — add admin-only news feed input wired to existing `updateGroup`
