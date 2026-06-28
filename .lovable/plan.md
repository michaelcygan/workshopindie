## Audit findings

### Settings (`/settings`) — mostly solid
- 6 sections wired to real server fns: Account (email change, password reset, language, default city, DOB display), Plus membership (Stripe portal), Notifications (prefs), Privacy (visibility + cc consent), Safety (blocked list, reports), Your data (export, delete).
- Gaps worth fixing for launch:
  1. **DOB row is read-only** — "Not set, add it on Edit profile" sends users to Edit profile which doesn't expose DOB either (it's collected at signup/age gate). Either show the value cleanly or remove the "add it" link so it's not a dead end.
  2. **Sign-out button duplicates the header menu** — minor, but remove from Account section to keep settings purely about configuration.
  3. **No "Connected accounts"** surface — Google OAuth users have no indication they're signed in via Google vs. email/password (the "Send reset link" button does nothing useful for OAuth-only accounts). Show provider and hide password row for OAuth-only.
  4. **No email-notification unsubscribe verification** — confirm `updateMyNotifPrefs` actually gates the transactional sender. (Sanity check only; no code change unless it's wrong.)

### "My stuff" submenu
Current items: My Collabs, Network, My Events, Refer & Earn.
- **My Collabs** — well-scoped (just finished).
- **Network** — `/me/network` redirects to `/me/friends`; keep the redirect, rename the file later. Fine.
- **My Events** (`/me/tickets`) — see consolidation below.
- **Refer & Earn** — live, wired to `referrals.functions`.

### My Events vs Events — consolidate, don't duplicate
They serve different needs (discovery vs. personal agenda) but a dedicated route + dropdown slot is overkill for v1.

**Proposal:** fold "My Events" into `/events` as a third toggle next to Upcoming/Past — `Mine` (signed-in only), driven by `?mine=1`.
- Keep `/me/tickets` as a permanent redirect to `/events?mine=1` so old links / .ics buttons keep working.
- Rename the dropdown entry from "My Events" → "My RSVPs" pointing to `/events?mine=1` (clearer; less collision with the top-nav "Events" link).
- Reuse `listMyUpcomingRsvps` (and add a past variant) inside `events.index.tsx` when `mine=1`. Render the same `EventCard` grid so the surface stays one page.

### Other peripheral flows — launch readiness
- `/me/tickets` `.ics` link points to `/api/public/events/${ev.id}/ics` — route exists (`events.$id.ics.ts`). Keep, move into the new Mine tab.
- `/me/blocked` is an 8-line file; confirm it's just a redirect to settings#safety (likely). Leave alone.
- `/refer` is live; no change.
- `/me/edit` (647 lines) is the profile editor — out of scope for this pass.

## Implementation plan

1. **`src/routes/events.index.tsx`**
   - Extend `searchSchema` with `mine: fallback(z.boolean(), false).default(false)`.
   - When `mine && user`, call `listMyUpcomingRsvps` (upcoming) / a new `listMyPastRsvps` server fn (past) instead of the public feed; map results to `EventCardData` shape.
   - Add a "Mine" pill to the When/Format toggle row, visible only when signed in. Empty state: "No RSVPs yet — browse upcoming events." with link clearing `mine`.

2. **`src/lib/group-events.functions.ts`**
   - Add `listMyPastRsvps` mirroring `listMyUpcomingRsvps` but `lt('starts_at', now)` desc, limit 30.

3. **`src/routes/me.tickets.tsx`** — replace body with a `redirect({ to: '/events', search: { mine: true } })` `beforeLoad`. Keeps bookmarks alive.

4. **`src/components/top-nav.tsx`**
   - Rename "My Events" → "My RSVPs"; navigate to `/events` with `search: { mine: true }`.

5. **`src/routes/settings.tsx` — Account section polish**
   - Detect OAuth providers via `user.app_metadata.providers`; if no `email` provider, hide the Password row and show a "Signed in with Google" chip in its place.
   - DOB row: when set, show the date plainly; when unset, show muted "Set during signup" (no broken CTA).
   - Remove the bottom "Sign out" button (header menu already has it).

6. **No DB changes, no new tables. No new routes other than the redirect.**

### Out of scope (call out, don't build)
- Multi-language support beyond the saved preference (UI not translated).
- 2FA / passkeys — defer post-launch.
- Notification email rendering audit — separate pass if you want.

### Technical notes
- `events.index.tsx` uses `zodValidator` already; `mine` boolean parses cleanly via `fallback`.
- `useAuth` is available at the route; gate the Mine pill on `user && !loading`.
- `redirect()` in `beforeLoad` of `me.tickets.tsx` requires importing `redirect` from `@tanstack/react-router`.
