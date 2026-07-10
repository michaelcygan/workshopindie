# Fix logged-out "Not found" on collab (and audit)

## Root cause

The `/collab/$slug` query embeds `profiles` (`user:profiles!...(...)`). Logged-out, PostgREST returns:

```
401 permission denied for table profiles
hint: Grant the required privileges to the current role with:
      GRANT SELECT ON public.profiles TO anon;
```

The RLS policy on `profiles` already allows `anon` SELECT (`USING (true)` for `{anon,authenticated}`), but the underlying table GRANT to `anon` was revoked at some point (current ACL for anon on `profiles` is `awdDxtm` — missing `r`/SELECT). Every logged-out surface that joins `profiles` fails the same way: collab detail, works detail, event detail, `u/$username`, groups pages, lounge previews, etc. `authenticated` still has SELECT, which is why the page works signed-in.

Audit of all public tables shows only two tables are missing anon SELECT:
- `public.profiles` — should have anon SELECT (policy already permits).
- `public.instant_rooms` — intentionally locked; not in scope.

## Change

One migration:

```sql
GRANT SELECT ON public.profiles TO anon;
```

That's it — the RLS policy `profiles public read` (`USING (true)` for anon) already scopes access; only the missing table grant was blocking PostgREST.

## Verification

1. Curl anon Data API for the failing collab embed — expect 200 with `user:{...}` populated.
2. Playwright anon load of `/collab/jesus-christ-diva-the-fame-ep-1` on workshopindie.com — expect the collab page (title, roles, apply CTA), not "Not found."
3. Spot-check other logged-out surfaces that embed profiles: `/works/<slug>`, `/g/<slug>/e/<eventSlug>`, `/u/<username>`, `/lounge`, `/events` — all should render.

## Out of scope for this change

The broader logged-out audit (guest apply → account claim handoff, works CTAs, event RSVP, lounge deep-links, profile pages, share/OG parity) is worth a follow-up pass, but this one grant unblocks every symptom you're seeing right now. I'll ship the grant first, verify each surface loads anon, and then flag any remaining logged-out gaps as a separate audit report (no code changes) so you can decide what to prioritize.
