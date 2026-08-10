# Fix: profiles won't load ("Couldn't load this profile")

## What's happening

Every profile page is failing for everyone — signed out (your Instagram link to @michaelcygan) and signed in (@mike). It is not a network blip; the database is refusing the read.

Confirmed by querying the live database directly: the profile page asks for a field called `categories_canonical` (the creative-field data added during the taxonomy unification), and that one column was never given read permission to visitors or signed-in members. The database rejects the whole request because of that single field, so the page falls back to the error screen.

Verified specifics:
- Reading `id`, `username`, `bio`, `aliases`, etc. as an anonymous visitor works fine.
- Reading `categories_canonical` returns `permission denied for table profiles` (error 42501) for both anonymous and signed-in roles.
- On `public.profiles`, only two columns lack grants: `categories_canonical` and `analytics_excluded`.

## The fix

One database migration:

```sql
GRANT SELECT (categories_canonical) ON public.profiles TO anon, authenticated;
```

`analytics_excluded` stays ungranted on purpose — it is admin-only and every code path that reads it already runs with the privileged server client, so it is unaffected.

No application code changes are needed. Row-level security is untouched; this only restores column read access that the taxonomy migration missed.

## Also fixed by the same grant

The same column is read on these pages, which are broken for the same reason:
- `/me/edit` (your own profile editor)
- `/applypodcast` (prefilling the application from your profile)

## Verification

1. Re-run the exact anonymous profile query against the live database and confirm it returns the row instead of a permission error.
2. Load `/michaelcygan` in a browser signed out, and confirm the profile renders with fields/specialties.
3. Load `/me/edit` and the profile from the bottom menu while signed in.

## Follow-up guard (small)

Add a short note to the project's migration conventions: `public.profiles` is governed by column-level grants, so any new column that the app reads must ship with its own `GRANT SELECT (col) ON public.profiles TO anon, authenticated;` in the same migration. This is what was missed and it will keep silently breaking profiles otherwise.
