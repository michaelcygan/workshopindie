## Root cause

Logged-out `/u/$username` fetches:

```
supabase.from("profiles").select("...,home_city:cities!profiles_home_city_id_fkey(...)")
```

PostgREST needs `SELECT` on the FK column (`home_city_id`) to resolve the embed. The current anon column grants (migration `20260720033925`) omit `home_city_id`, so the whole query returns `42501 permission denied for table profiles`. `fetchProfile` throws, React Query returns no data, and the route renders "Profile not found".

Verified against production PostgREST with the anon key: the query works without the `home_city` embed and fails with it. Same query works when signed in because policy allows full row read for `authenticated`.

## Fix

Add `home_city_id` to the anon column grant on `public.profiles` (same list as migration `20260720033925`).

```sql
GRANT SELECT (home_city_id) ON public.profiles TO anon;
```

That restores `/u/$username` for logged-out visitors (Instagram in‑app browser, mobile Safari signed out) without re-exposing PII columns (birthdate, real name, age filters, etc. stay revoked).

## Notes

- Not touching authenticated/service_role grants.
- No client-side changes needed.
- Screenshot 1 (signed in) already works because RLS/grants for `authenticated` include full row.