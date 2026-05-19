## Launch audit — findings

I walked every route file and every internal `<Link>` / `<Button>` in `src/routes/` and `src/components/`. All declared `to="/..."` targets resolve to real route files. The dead surfaces are concentrated in one place: **scheduled Workshops is admin-gated, but several places still send normal users there**.

### Findings

**1. Workshops layout is admin-only — non-admins hit "Coming soon" from logged-in surfaces**

`src/routes/workshops.tsx` wraps the entire `/workshops/*` subtree in an `isAdmin` check and renders `<ComingSoon>` otherwise. That means every link below ends at the coming-soon screen for normal users:

- `src/routes/me.tsx`
  - `HostingList` empty state → `ctaTo="/collab"` (already fine), but the items themselves `<Link to="/workshops/$slug">` → ComingSoon for non-admins
  - `AppliedList` empty state → `ctaTo="/workshops"` (dead) + items link to `/workshops/$slug` (dead)
  - `ParticipatingList` empty state → `ctaTo="/workshops"` (dead) + items link to `/workshops/$slug` (dead)
- `src/components/workshop-card.tsx` — entire card overlay links to `/workshops/$slug`. Currently only rendered from `workshops.index.tsx` (admin-only), so safe today, but worth noting.

**2. `me.tsx` tabs assume workshops exist for everyone**

The `hosting / applied / participating` tabs are visible to all users but only ever populate from scheduled-workshop tables. For non-admins they will always be empty and their empty-state CTAs point at the gated `/workshops` routes.

**3. Misc — verified OK, no changes needed**

- All `to="/..."` targets exist as route files (cross-checked the full list).
- `gallery` accepts the `city` search param the city page passes.
- No `href="#"`, no buttons without `onClick`, no obvious "TODO" stubs in user-facing routes.
- `/admin` and `/admin/badges` are correctly gated and reachable only from the admin dropdown.
- Hero CTAs, top-nav, mobile-nav, notifications bell, signup/login crosslinks, profile / works / collab / cities cards all resolve.

### Fix plan (frontend only, no new functionality)

**A. Make `/workshops/$slug` viewable for everyone (read-only deep-link).**
Move the `isAdmin` gate off the layout so detail pages stay accessible for anyone with the URL or a `me.tsx` history row. Keep gating only on the index + new pages:

- `src/routes/workshops.tsx` → revert to a plain `<Outlet />` wrapper.
- `src/routes/workshops.index.tsx` → wrap its component body with the `isAdmin` / `ComingSoon` check (so `/workshops` itself still says "Coming soon").
- `src/routes/workshops.new.tsx` → same admin gate at the component level so non-admins can't open the creation form directly.

This keeps existing host/applied/participating history clickable from `/me` without re-launching scheduled workshops to the public.

**B. Repoint `me.tsx` empty-state CTAs away from `/workshops`.**

- `AppliedList` empty: change copy + `ctaTo` to `"/collab"` ("Browse open collabs").
- `ParticipatingList` empty: change to `"/instant"` ("Drop into a live Workshop").
- `HostingList` empty already points at `/collab` — leave it.
- Update the `EmptyState` `ctaTo` union type accordingly (drop `"/workshops" | "/workshops/new"`).

**C. Hide the workshop-history tabs when they're empty AND the user is a non-admin.**
In `me.tsx`, if `counts.hosting + counts.applied + counts.participating === 0` and the user is not an admin, hide those three tabs and default `tab` to `drafts`. Users who actually have legacy workshop rows still see them.

### Out of scope

No backend, schema, or new feature work. Pure frontend cleanup so nothing on the live site routes to a dead page.
