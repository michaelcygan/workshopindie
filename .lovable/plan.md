## Two small fixes

### 1. About → "News feed" input not visible for platform admins

`GroupNewsFeedSetting` in `src/routes/g.$slug.tsx` only shows when the viewer has `owner`/`steward` in `group_members`. As a platform admin who isn't a member of that group, `canEdit` resolves false and the section is hidden — which is why the input is missing on `/g/soundcloud-rappers`.

Fix: extend the `canEdit` query to also call `supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })` and OR the two results. The server fn `setGroupNewsFeed` already permits platform admins, so this is purely a UI gate change.

### 2. Set the SoundCloud Rappers feed now so the ticker is testable

Run a one-line migration that sets `groups.news_feed_url` for `slug = 'soundcloud-rappers'` to the Google News RSS URL you supplied. No schema change.

```sql
UPDATE public.groups
SET news_feed_url = 'https://news.google.com/rss/search?q=%22SoundCloud%20rap%22%20OR%20%22underground%20rap%22%20OR%20%22emerging%20rappers%22%20OR%20%22independent%20rapper%22%20OR%20%22viral%20rapper%22%20OR%20%22rap%20streaming%22%20OR%20%22Spotify%20rap%22%20OR%20%22XXL%20Freshman%22%20OR%20%22mixtape%20rap%22%20OR%20%22new%20hip%20hop%22&hl=en-US&gl=US&ceid=US:en'
WHERE slug = 'soundcloud-rappers';
```

### Files
- `src/routes/g.$slug.tsx` — extend `canEdit` in `GroupNewsFeedSetting` to include platform admins.
- migration — UPDATE the news_feed_url on the soundcloud-rappers group.
