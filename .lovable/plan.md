## Problem

Every group page (`/g/:slug`) errors with "Could not find a relationship between 'groups' and 'groups' in the schema cache". The URL structure is fine — `/g/indie-filmmakers` is the correct shape. The real cause is the PostgREST embed added last turn:

```ts
.select("...,parent:groups!groups_parent_group_id_fkey(id,slug,name)")
```

PostgREST's schema cache is not resolving the self-referential FK embed reliably, even after a `NOTIFY pgrst, 'reload schema'`. Self-joins through embeds are fragile and break the entire page load.

## Fix

Drop the embed and fetch the parent in a second, tiny query only when `parent_group_id` is set. This removes the self-join entirely and is robust to any cache state.

### Changes in `src/routes/g.$slug.tsx`

1. In `fetchGroup`, remove `parent:groups!...(id,slug,name)` from the select. Keep `parent_group_id` on the row.
2. After the group loads, if `parent_group_id` is not null, run a second `supabase.from("groups").select("id,slug,name").eq("id", parent_group_id).maybeSingle()` and attach the result as `parent`.
3. Keep the `GroupRow.parent` shape the same so breadcrumb / tab code downstream doesn't need to change.

No database migration. No URL changes. No other files touched.

## Why not "fix the cache"

`NOTIFY pgrst, 'reload schema'` already ran and the error persists, which means relying on the embed is brittle for a self-FK on this project. A two-query fetch costs one extra small round-trip on group pages that have a parent (none today) and zero extra work on top-level groups. Worth it for reliability.
