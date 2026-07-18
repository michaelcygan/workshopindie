## Diagnosis (confirmed)

The `/u/$username` profile page fails for logged-out visitors (Instagram in-app browser is unauthenticated) with a false "Profile not found."

Root cause — verified via anon REST calls against the live DB:
- `fetchProfile` in `src/routes/u.$username.tsx` includes `alias_urls` in its `select`.
- PII hardening previously revoked `SELECT` on `alias_urls` from the `anon` role (`has_column_privilege('anon', ..., 'alias_urls')` = false).
- PostgREST rejects the whole request with `42501 permission denied for table profiles` when any selected column lacks anon SELECT.
- The React Query catches the error and falls through to the "Profile not found" empty state — the same UI shown for a truly missing handle.

Signed-in users don't hit it because `authenticated` has the grant. IG in-app browser has no Workshop session, so it behaves as `anon`.

## Fix

Split the profile select into anon-safe vs. authenticated in `src/routes/u.$username.tsx`:

1. Detect auth state (existing `useAuth`/session already read elsewhere in the file, or a quick `supabase.auth.getSession()` inside `fetchProfile`).
2. Build the column list dynamically:
   - Base (anon-safe): everything currently requested EXCEPT `alias_urls`.
   - Authenticated: base + `alias_urls`.
3. When anon, default `alias_urls` to `[]` in the returned object so downstream UI (alias pills) renders empty rather than crashing.

No DB migration — `alias_urls` was intentionally hardened, so we respect that boundary from the client instead of re-granting to anon.

## Verification

- Anon `curl` against `/rest/v1/profiles?username=eq.michaelcygan&select=<new list>` returns 200 with the row.
- Load `https://workshopindie.com/u/michaelcygan` in a private window → profile renders.
- Signed-in view still shows alias URL pills.

Scope: single file, `src/routes/u.$username.tsx`. No schema, no other routes.
