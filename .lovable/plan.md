## Goal

One unified profile (Instagram-style). `/u/$username` is the single source of truth. `/me` redirects there. Owner-only flourishes are toggled on by `isOwn`. Fix the title-clipping issue while restructuring the header.

## 1. Unify `/me` → `/u/$username`

- `src/routes/me.index.tsx` becomes a thin redirect: look up the signed-in user's `username`, then redirect to `/u/{username}`. If no username yet → `/onboarding`.
- All owner-only dashboard content (drafts, applied/participating, closed-collab nudges, primary CTAs) moves onto `/u/$username`, gated by `isOwn`.
- `/me/edit` stays as-is.
- Header/menu links can still point to `/me`; the redirect resolves to the public URL on landing.

## 2. Fix title clipping

Restructure the header so only the avatar overlaps the cover. Name, handle, city, headline, and CTAs all sit cleanly below the cover edge.

```text
[ cover photo                                          ]
[ avatar (overlaps) ]                  [ Edit / Follow ]
       Name + badge
       @handle · 📍 City · IG
       Headline
       [Owner CTAs row]
       [Stats strip]
       [Tabs]
```

## 3. Owner-only flourishes on the unified profile

Visible only when `isOwn`:

- Cover empty state ("Add cover photo") — already in place ✓
- Primary CTA row under headline: **Publish a Work**, **Post a Collab**, **Drop into a Workshop**
- Closed-collab "wrap up" nudges (moved from `/me`) — above the tab bar
- Two new owner-only tabs added to the existing set:
  - `Drafts` — unpublished works
  - `Activity` — applied + participating Workshops, combined chronologically
- `Hosting` is NOT a separate tab — hosted Workshops already appear in the public `Workshops` tab (with a host/participant chip).

Owner tab order: `Works · Drafts · Credits · Collabs · Workshops · Activity · Groups · About`
Visitor tab order (unchanged): `Works · Credits · Collabs · Workshops · Groups · About` (empty ones still hidden for visitors)

## 4. Files touched

- `src/routes/me.index.tsx` — replace with redirect; remove now-unused list components.
- `src/routes/u.$username.tsx` — restructure header (fix clipping), add owner CTA row, closed-collab nudges, Drafts + Activity tabs + their data queries (only fetched when `isOwn`).
- No DB, schema, or other route changes.

## Out of scope

- `/me/edit` form changes
- Credits hide/show management (stays as-is inside Credits tab when owner)
- Notifications, settings
