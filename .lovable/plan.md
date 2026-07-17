# Fix `/me/edit` stuck on "Loading…"

## Root cause (confirmed)

The recent PII hardening revoked table-level `SELECT` on `public.profiles` from `authenticated` and re-granted `SELECT` only on non-sensitive columns (birthdate/age fields stay owner-only via `getMyAgeFields`). Verified via `pg_class.relacl`: `authenticated` has `awdDxtm` — no `r` (SELECT) at the table level.

`src/routes/me.edit.tsx` still hydrates the form with:

```ts
supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
```

`select("*")` expands to include the revoked columns (`birthdate`, etc.) → PostgREST returns a permission error → `data` is `null` → the code does `if (!data) return;` and never flips `hydrated` to `true`. The route stays on the "Loading…" placeholder forever (matches the screenshot).

This is the same class of bug that would bite any other place still doing `select("*")` on `profiles`.

## Fix

1. **`src/routes/me.edit.tsx`** — replace `select("*")` with an explicit column list matching the fields the form actually reads:
   `id, username, first_name, last_name, aliases, alias_urls, instagram_handle, headline, bio, artist_statement, avatar_url, cover_url, cover_work_id, categories, mediums, tools, external_links, city_id, pinned_work_ids`.
   Also surface `error` from the response: if present, `toast.error(error.message)` and still set `hydrated(true)` so the user sees the form (empty) instead of an infinite spinner.

2. **Audit other `profiles` reads for `select("*")`** and narrow them the same way. Grep `select("*")` / `select('*')` against `from("profiles")` across `src/` and fix any hits (read-only investigation this turn; edits happen in build mode).

3. **No schema/grant changes.** The PII lockdown stays as-is — `birthdate` continues to be owner-only via `getMyAgeFields`, which the page already calls.

## Out of scope

- No changes to age/birthdate flow — that already uses `getMyAgeFields`.
- No RLS or grant changes.
