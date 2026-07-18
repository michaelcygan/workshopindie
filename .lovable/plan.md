## Goal
Hide Today board posts from logged-out visitors. Logged-in viewers (joined or not) can still read; only joined members can post.

## Changes

### 1. Database (migration)
`group_today_posts.today_read` currently applies to `public`, so anon can read.
- Drop `today_read` and recreate scoped `TO authenticated` with the same `USING` expression (still requires public group or membership + unexpired).
- `REVOKE SELECT ON public.group_today_posts FROM anon;` to remove the Data API grant.
- Leave INSERT/DELETE policies and `authenticated`/`service_role` grants untouched.

Post logic (`canPost = user && isMember`) already correct — no change.

### 2. UI — `src/components/group/group-today-tab.tsx`
In the Today card:
- If `!user`: replace the messages scroller with a compact centered CTA ("Sign in to see what's happening in {city} today") linking to `/login?redirect=<current href>`. Keep the card header/date pill for context. Hide the composer entirely (already shows "Sign in to chat" placeholder — replaced by the CTA state).
- If `user && !isMember`: unchanged — reads messages, composer disabled with "Join to chat" hint.
- If `user && isMember`: unchanged.

Also skip the `listTodayPosts` query when `!user` to avoid a guaranteed empty/401 fetch.

### 3. Out of scope
- Sidebar modules (Recent Collabs, Recent Works, Next Event) remain public.
- No changes to group visibility, membership, or other tabs.
