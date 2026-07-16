## Fix: Pinned pieces from Edit Profile don't show on the profile Pin Bar

**Root cause**
Two disconnected data models for pinned Works:
- `src/routes/me.edit.tsx` saves the user's picks to `profiles.pinned_work_ids` (ordered array; L193/L224).
- `src/routes/u.$username.tsx` `fetchPinnedWorks` (L216–248) reads from `work_credits.pinned_at`.

Nothing bridges them, so the Pin Bar is always empty for Works pinned via Edit Profile. (Pinned Collabs use `collab_posts.pinned_at`, which is written elsewhere and works correctly — no change there.)

**Fix — single source of truth: `profiles.pinned_work_ids`**
Rewrite `fetchPinnedWorks(userId)` in `src/routes/u.$username.tsx`:

1. Read the profile's `pinned_work_ids` array (either accept it as a parameter from the already-loaded profile, or fetch it here). Simpler: change the signature to `fetchPinnedWorks(pinnedIds: string[])` and update the caller to pass `profile.pinned_work_ids`.
2. Early-return `[]` when the array is empty.
3. Query `works` with `.in("id", pinnedIds)` selecting the same columns as today (+ `work_credits(...)` join for credit chips), filtered by `status = 'published'` and `visibility in ('public','unlisted')`.
4. Re-sort the returned rows to match the `pinnedIds` array order (array position = display order) and slice to 6.
5. Map to `WorkCardData` exactly as today.

Update the caller:
- `useQuery` key becomes `["profile-pinned", profile?.id, profile?.pinned_work_ids]` so it refetches when the array changes.
- `enabled: !!profile?.id`.
- `queryFn: () => fetchPinnedWorks(profile!.pinned_work_ids ?? [])`.

No schema migration needed; the `work_credits.pinned_at` column can remain unused for now (not touched by this change).

**Verification**
- On `/u/<me>` after pinning items in `/me/edit`, the Pin Bar shows the selected Works in the chosen order.
- Re-ordering / removing in Edit Profile updates the Pin Bar after save.
- Pinned Collabs continue to show via the unchanged `fetchPinnedCollabs`.

**Files touched**
- `src/routes/u.$username.tsx` only (fetcher + caller). No other files, no DB changes.