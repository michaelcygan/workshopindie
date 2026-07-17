
## Goal

Every "city" surface should resolve to that city's Group page (`/g/$slug`). When a user sets a home city that has no group yet, create one automatically and enroll the user.

## Current state (verified)

- Group slug equals city slug for every existing city (checked via DB: `chicago`/`chicago`, `austin`/`austin`, etc.), so no slug remapping needed.
- All existing cities already have a `kind='city'` group (0 orphans).
- Legacy detail page: `src/routes/cities.$slug.tsx` (the "defunct" page in screenshot 1).
- City-detail links point to `/cities/$slug` from: `src/routes/u.$username.tsx` (5 places), `src/routes/index.tsx` (home-city meetups block), `src/routes/cities.index.tsx` (featured + list cards).
- `home_city_id` is written from `src/routes/onboarding.tsx`, `src/routes/settings.tsx`, and admin tools.

## Changes

### 1. Redirect the defunct city detail page
Replace `src/routes/cities.$slug.tsx` body with a `beforeLoad` that throws `redirect({ to: "/g/$slug", params: { slug } })`. Keep the file so old bookmarks/inbound links continue working. `cities.index.tsx` (the browsable directory) stays for now — only its outbound links change.

### 2. Repoint all in-app city links to `/g/$slug`
Update the `Link to="/cities/$slug"` call sites listed above (profile header meta, profile Groups section, home-page home-city meetups, cities index cards) to `Link to="/g/$slug"`. Also update `sitemap[.]xml.ts` city URLs to `/g/<slug>`.

### 3. Auto-create city group + membership on `home_city_id`
Add a Postgres trigger (via migration) on `public.profiles` `AFTER INSERT OR UPDATE OF home_city_id`, running as `SECURITY DEFINER`:

- If `NEW.home_city_id IS NOT NULL`:
  - Look up the city row.
  - `INSERT ... ON CONFLICT (slug) DO NOTHING` into `groups` with `kind='city'`, `slug = city.slug`, `name = city.name`, `city_id = city.id`, `join_mode='open'`, `visibility='public'`, `is_official=true`, `created_by = NEW.id`, `category='city'` if applicable.
  - Fetch the group id (existing or new) and `INSERT INTO group_members(group_id, user_id, role) VALUES (..., NEW.id, 'member') ON CONFLICT DO NOTHING`.

This covers onboarding, settings, admin edits, and any future write path — no client-side branching needed.

### 4. Backfill
Same migration: for every profile with a `home_city_id`, ensure a group exists (they all do today) and insert missing `group_members` rows.

## Out of scope

- Cities directory page (`/cities`) stays as a discovery index; only its links are repointed. If you want it fully removed/redirected to the Groups → Cities tab, say so and I'll add it.
- No changes to the group page itself.

## Technical notes

- Slugs are already aligned, so the redirect is a simple param passthrough.
- Trigger uses `SECURITY DEFINER` + `SET search_path = public` so it bypasses the "Admins add members" RLS restriction on `group_members` while remaining safe (only inserts the row for `NEW.id`).
- `groups.slug` has a UNIQUE constraint, so `ON CONFLICT (slug) DO NOTHING` is race-safe.
