## Wave 2 — Free Blog: 2 publications per UTC month

Today, Free users can only draft; publishing is gated to Plus/granted (`src/lib/blog-access.server.ts`, `publishMyBlogPostServer`). Spec says Free should be able to **publish up to 2 posts per UTC calendar month**. Plus, admin-granted, and Stripe-trialing accounts stay unlimited. Lapsed accounts drop back to the Free quota (they can still manage/unpublish existing posts). Suspended stays blocked.

### 1. Database (migration)

- Add a `STABLE SECURITY DEFINER` SQL function `public.blog_member_publications_this_month(_user_id uuid) RETURNS int`, counting rows in `public.blog_posts` where `publication_type='member'`, `status='published'`, `created_by=_user_id`, and `date_trunc('month', published_at AT TIME ZONE 'utc') = date_trunc('month', (now() AT TIME ZONE 'utc'))`.
- Add `public.try_consume_blog_publication(_user_id uuid, _post_id uuid, _limit int) RETURNS boolean` — takes a per-user `pg_advisory_xact_lock`, re-checks the monthly count, and flips the given post to `status='published'`, `published_at=now()`, `updated_by=_user_id`, and returns true; returns false if the user is at cap. Runs `SECURITY DEFINER`, `search_path=public`. This closes the race between two concurrent publishes at 1/2.
- No new tables, no new grants (functions inherit `EXECUTE` for authenticated via existing project pattern; add explicit `GRANT EXECUTE … TO authenticated, service_role` in the same migration to be safe).

### 2. `src/lib/blog-access.server.ts`

Extend `BlogAccess`:
```ts
publicationsThisMonth: number;
monthlyPublicationLimit: number | null; // null = unlimited
```
Behavior per mode:
- `plus`, `granted` → unlimited, `canPublish: true`.
- `trial` → **unchanged** (still no public publish; trial = "Plus-in-progress" but current product keeps trial pre-publish gated — see open question below).
- `free`, `lapsed` → `canCreateDraft: true`, `canPublish: publicationsThisMonth < 2`, `activeDraftLimit: null`, `monthlyPublicationLimit: 2`. Reason strings say `"You've published 2 of 2 posts for <Month YYYY>. New publishing opens on <first of next month, UTC>."` when at cap.
- `suspended` → unchanged.

Source the `2` from `FREE_BLOG_PUBLICATIONS_PER_MONTH` in `src/lib/entitlements.ts`.

### 3. `src/lib/blog-member.server.ts`

- `publishMyBlogPostServer`: after ownership + `resolveBlogAccess`, keep all validation (title/body/alt-text/entity visibility/moderation) and slug finalization. Replace the direct `update({ status: 'published' })` with an RPC call to `try_consume_blog_publication`. On `false`, throw the same "at cap for this month" message. Plus/granted skip the RPC and use the existing update path.
- `unpublishMyBlogPostServer` — unchanged. Unpublishing does not restore quota; the count is based on `published_at` timestamp of currently-published posts, so an unpublished post is not counted.

### 4. Server-fn surface

`getMyBlogAccessServer` already returns the access object; the new fields flow through automatically to `useMyBlogAccess` on the client. No new endpoint.

### 5. UI

- `src/routes/me.blog.index.tsx` — add a quota chip in the header when `monthlyPublicationLimit != null`: `"Published X of 2 this month · resets Aug 1"`. If `!canCreateDraft` reason exists, show it as a subtle notice.
- `src/routes/me.blog.$id.tsx` (editor) — the publish button already uses `access.canPublish` and `access.reason`. Add the quota chip next to it, and adjust the disabled tooltip to the new copy.
- `src/components/plus-gate.tsx` — no change (Wave 4 handles blog-specific gate copy).

### 6. Verification

- `tsgo` clean.
- `psql` sanity: `SELECT public.blog_member_publications_this_month('<uid>');` returns 0 for a fresh account.
- Manual: as a Free user, publish 2 drafts → third publish throws the "at cap" message; unpublish one → third still blocked (count is by `published_at`, which remains for the two currently-live posts); wait for next UTC month → publishing opens again.

### Files expected to change

- **New migration** (adds `blog_member_publications_this_month`, `try_consume_blog_publication`, grants EXECUTE).
- `src/lib/blog-access.server.ts` — extend `BlogAccess`, allow Free/lapsed to publish under quota.
- `src/lib/blog-member.server.ts` — swap publish update for the RPC call.
- `src/routes/me.blog.index.tsx` — quota chip.
- `src/routes/me.blog.$id.tsx` — quota chip + updated tooltip copy.

### Open question (one)

Trial (`status='trialing'` Plus subscription): today they can draft but not publish. Spec removes the "publishing needs Plus" wall. Two reasonable readings:

- **A.** Trial = Plus (unlimited publishing during the 14-day trial). Simple, matches Stripe's usual "trial is full access".
- **B.** Trial = Free quota (2/month) until first payment.

I'll go with **A** unless you say otherwise — it matches every other Plus-during-trial capability in the app.

### Not in this wave

- Lounge monthly hours enforcement — Wave 3.
- `plus-gate.tsx` `reason` variants — Wave 4.
- The `work_applications` RLS security finding — will patch in a separate small change before the final wave.
