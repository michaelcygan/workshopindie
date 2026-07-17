# Fix: Group Today board PGRST200

## Root cause (confirmed)
`group_today_posts.author_id` has only one FK: `group_today_posts_author_id_fkey → auth.users(id)`. The Today tab embeds `author:profiles!group_today_posts_author_id_fkey(...)`, but that constraint points at `auth.users`, not `public.profiles`. PostgREST returns PGRST200 and the board renders empty even though inserts succeed.

## Changes

### 1. Migration (reversible, additive)
- Add a second FK on `public.group_today_posts.author_id` referencing `public.profiles(id) ON DELETE CASCADE`, named `group_today_posts_author_profile_fkey`.
- Keep the existing `group_today_posts_author_id_fkey → auth.users(id)` constraint untouched.
- No data changes; every author already has a matching `profiles` row (profiles.id mirrors auth.users.id via the standard onboarding trigger). If the migration validation fails on legacy rows, add it `NOT VALID` then `VALIDATE CONSTRAINT` — no row deletions.
- Run `NOTIFY pgrst, 'reload schema';` at the end so PostgREST picks up the new relationship immediately.

### 2. `src/components/group/group-today-tab.tsx`
- Update the embedded select on line 71 to use the new constraint name exactly:
  `author:profiles!group_today_posts_author_profile_fkey(username,display_name,avatar_url)`
- Add a visible error state for the posts query: when `useQuery` returns `error`, render an inline error card with the message and a "Retry" button that calls `refetch()`, so a failed fetch never looks like an empty board. Empty-state and loading behavior stay as-is.

### 3. Not changed
- `postTodayMessage`, membership/authorization checks, moderation, expiry logic, and the board's visual design remain untouched.
- The sidebar (Fresh Collabs / Recent Works) is unaffected.

## Acceptance
- Chicago member posts → message appears with avatar, persists after refresh.
- Existing active posts become visible.
- Non-members still blocked by existing RLS/postTodayMessage checks.
- No PGRST200 in console/network.
