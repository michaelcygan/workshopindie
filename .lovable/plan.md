# Admin "Seed Group" share links — auto-join after signup

Goal: admin generates a shareable link for ad campaigns (Meta etc.) that drops a visitor on a Group page. Logged-in visitors are joined immediately. Logged-out visitors get an inline "Create an account to join {Group}" prompt, and after signup or sign-in they're auto-added to that group and returned to it.

## Data model

New migration adds `group_seed_links`:
- `id uuid pk`
- `group_id uuid → groups(id) on delete cascade`
- `token text unique` (8-char base32, used in URL)
- `label text` (admin-facing only, e.g. "Meta — NYC creators Mar")
- `utm_source / utm_medium / utm_campaign text` (optional)
- `is_active bool default true`
- `created_by uuid → auth.users(id)`
- `click_count int default 0` (logged-out + logged-in landings)
- `signup_count int default 0` (new accounts redeemed)
- `join_count int default 0` (memberships added via this link)
- `created_at / updated_at timestamptz`

Indexes: `(token)`, `(group_id)`, `(created_at desc)`.

Grants: `SELECT` to anon for `(id, group_id, token, is_active)` exposure via a security-definer RPC only — table itself is `GRANT ALL TO service_role`, `GRANT SELECT, INSERT, UPDATE, DELETE` to authenticated for admin reads (gated by RLS).

RLS:
- `admin manage all` — uses `has_role(auth.uid(),'admin')` for ALL.
- No direct anon SELECT. Public resolution happens through two security-definer RPCs:
  - `public.resolve_group_seed_link(_token text)` → returns `{ group_id, group_slug, group_name, is_active }`; increments `click_count` when active. Grant EXECUTE to anon + authenticated.
  - `public.redeem_group_seed_link(_token text)` → inserts into `group_members` for `auth.uid()` if not already a member, increments `join_count`, and if the user's `created_at` is within the last 10 minutes also increments `signup_count`. Returns `{ group_id, joined: bool, already_member: bool }`. Grant EXECUTE to authenticated only.

## Server functions

New file `src/lib/group-seed-links.functions.ts`:
- `createGroupSeedLink({ group_id, label, utm_source?, utm_medium?, utm_campaign? })` — admin only (`has_role` check inside, like other admin fns). Generates token, writes audit row to `admin_audit_log`.
- `listGroupSeedLinks({ q?, group_id? })` — admin only, joins to `groups(name, slug, accent_color)`.
- `updateGroupSeedLink({ id, patch })` — admin only (toggle active, edit label/UTM).
- `deleteGroupSeedLink({ id })` — admin only.
- `resolveGroupSeedLink({ token })` — public; wraps the `resolve_group_seed_link` RPC via the server publishable client. Returns null when missing/inactive.
- `redeemGroupSeedLink({ token })` — `requireSupabaseAuth`; wraps the `redeem_group_seed_link` RPC.

## Routing & client flow

### URL shape

`https://workshopindie.com/g/<slug>?j=<token>` (UTM params can ride along; we read only `j`).

### Group page (`src/routes/g.$slug.tsx`)

Add an effect: when `search.j` is present:
1. Call `resolveGroupSeedLink({ token: j })` once on mount. (Records the click.) If it returns a group whose slug doesn't match the current page, redirect to the canonical slug — defends against a token whose group was renamed.
2. Stash `pendingJoin = { token, slug }` in `sessionStorage` under key `ws.pendingGroupJoin` so it survives the auth redirect.
3. If `user` is present → immediately call `redeemGroupSeedLink({ token })`, invalidate `["group-membership", groupId]` + `["my-group-ids"]`, toast "Joined {Group}", clear sessionStorage and strip `?j=` from the URL (`router.navigate({ search: (prev)=>({ ...prev, j: undefined }), replace: true })`).
4. If `user` is null → render a new `GroupSeedJoinPrompt` (sticky banner + first-visit modal): "Create an account to join {Group}." with primary CTA → `/signup?join=<token>&group=<slug>` and secondary "I already have an account" → `/login?join=<token>&group=<slug>`. The banner persists across re-renders until joined or dismissed.

### `signup.tsx` + `login.tsx`

- Extend each route's `validateSearch` to accept `join: string` and `group: string`.
- Pre-fill copy: if `search.join` is present, show a kicker chip "Joining {search.group}" and change the submit button label to "Create account & join {group}" / "Sign in & join {group}".
- After successful auth (both pages), check `search.join` first (then sessionStorage `ws.pendingGroupJoin` as fallback). If present: call `redeemGroupSeedLink({ token })`, then `navigate({ to: "/g/$slug", params: { slug: search.group } })`. Toast "Joined {Group}". Existing `claim` branch stays ahead in priority; the new branch sits between it and the default `navigate({ to: "/" })`.
- For `GoogleSignIn` (OAuth round-trip), the post-OAuth callback doesn't keep the query string. We rely on `sessionStorage` (set above on the group page or on signup/login mount). Wire a one-shot effect inside `src/routes/__root.tsx`'s existing `onAuthStateChange` handler: when the event is `SIGNED_IN` and `sessionStorage` has `ws.pendingGroupJoin`, call `redeemGroupSeedLink`, clear storage, and `router.navigate` to the group page. Keep this effect tiny and idempotent.

### Admin UI (`src/routes/admin.links.tsx`)

Add a sibling section above the existing Workshop links section: **Group seed links**.
- Builder form: group picker (typeahead querying `groups` by name/slug, returns top 10), label, optional UTM fields, "Create link" → copies `https://<host>/g/<slug>?j=<token>` to clipboard.
- List: rows show `{group.name} · label · token`, copy/open/toggle-active/delete, and a stats trio `clicks · signups · joins`.
- Reuses `useServerFn` patterns already in this file.

Keep both sections on one page; no new route needed.

## OG / SEO

No change. `/g/<slug>` already sets head() with group metadata, so paid traffic gets the rich preview.

## Failure & abuse considerations

- `resolve_group_seed_link` returns null and the page renders normally if the token is missing/disabled (no error, no leak).
- `redeem_group_seed_link` is idempotent — calling twice doesn't double-count `join_count` (only increments when the insert actually happened).
- Click count is incremented by the resolve RPC; a single visitor refreshing inflates clicks. Acceptable for v1 (matches how `share_events` is tracked elsewhere); we can dedupe by IP later if needed.
- `signup_count` heuristic ("auth.users.created_at within last 10 minutes") is good enough; can tighten later.

## Files touched

Create:
- `supabase/migrations/<ts>_group_seed_links.sql`
- `src/lib/group-seed-links.functions.ts`
- `src/components/group-seed-join-prompt.tsx`
- `src/components/admin/group-seed-links-panel.tsx`

Edit:
- `src/routes/admin.links.tsx` — mount the new panel
- `src/routes/g.$slug.tsx` — accept `?j=`, resolve+redeem effect, render prompt
- `src/routes/signup.tsx` — extend `validateSearch`, post-auth join branch, kicker
- `src/routes/login.tsx` — same
- `src/routes/__root.tsx` — extend existing `onAuthStateChange` to flush `ws.pendingGroupJoin`

## Verification

1. Admin → `/admin/links`: create a link for a known group; URL copies to clipboard.
2. Open the link in a fresh incognito tab: group page loads, sticky banner shows "Create an account to join {Group}". Click count = 1 in admin.
3. Click "Create account & join", complete signup: redirected to `/g/<slug>`, toast confirms, "Joined" button state, join_count = 1, signup_count = 1.
4. Sign out, open the link again: banner shows again. Click "I already have an account", sign in: same auto-join behavior, join_count = 2, signup_count unchanged.
5. Already-a-member tab opens the link: auto-redeem is a no-op (already_member=true), join_count unchanged, `?j=` stripped from URL.
6. Disable the link in admin, open it again: page renders normally with no banner, no clicks recorded.
