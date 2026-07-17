## Diagnosis

Logged-out visitors (including the Instagram in-app browser) hit "Profile not found" on `/u/@michaelcygan` because the `public.profiles` table has **no `SELECT` grant to `anon`**.

Verified against the backend:
- RLS on `profiles` has a `profiles public read` policy `USING (true)` for `{anon, authenticated}` — good.
- But `has_table_privilege('anon','public.profiles','SELECT')` returns **false**.
- PostgREST checks table-level GRANTs *before* RLS, so anon requests to `profiles` fail silently and `fetchProfile()` returns `null` → the "No creator with the handle" screen.
- Sibling public tables (`works`, `work_credits`, `cities`, `collab_posts`, `collab_roles`, `follows`) all already have anon SELECT, which is why only the profile page breaks for logged-out users.

Authenticated users see profiles fine because `authenticated` does have SELECT — that's why this only reproduces in the IG browser / signed-out sessions.

## Fix

Single migration that grants anon read on `profiles` to match the existing RLS policy:

```sql
GRANT SELECT ON public.profiles TO anon;
```

No schema, RLS, code, or column changes. No new dependencies. The existing `profiles public read` policy already scopes what anon can see (it's `true`, matching the intent that profile pages are public just like `/works/*` and `/collab/*`).

## Why not restrict columns instead

The current design already treats profile pages as fully public content (SEO loader indexes them, share URLs are meant for logged-out visitors). Matching the existing policy with a table-level GRANT is the minimum change that restores the intended behavior without altering the security model.

## Verification

After the migration:
1. Re-check `has_table_privilege('anon','public.profiles','SELECT')` → should be `true`.
2. Load `/u/michaelcygan` in a private window (no session) — profile renders.
3. Reload in the IG in-app browser — profile renders.
