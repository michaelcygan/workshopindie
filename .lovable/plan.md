## Launch readiness — blockers only

The platform is in good shape. Two true blockers, a handful of must-fix-before-traffic items, and a short UI polish list informed by your "real activity" lens.

### Maps / Google

- **No Google Maps key needed.** `VenueMap` already uses Leaflet + OpenStreetMap (free, no key).
- **No Google API key needed for sign-in.** Lovable Cloud manages the OAuth credentials. You only need your own client ID if you want the consent screen branded with `workshopindie.com` — fully optional, not a launch blocker.

## 1. Security blockers (must fix before launch)

Pulled from the latest security scan against your live schema.

**Critical (data exposure):**
1. **`profiles` table is publicly readable with `USING (true)`** — exposes `birthdate`, `first_name`, `last_name`, `age_filter_min`, `instagram_handle`, `dm_policy` to anyone, signed-in or not. Fix by replacing the public SELECT policy with one that exposes a safe column subset, or by routing public reads through a view that drops PII. Anonymous visitors should only see public-display fields.
2. **`realtime.messages` has no RLS** — any signed-in user can subscribe to any channel topic, including private workshop rooms, DMs, and notification channels. Add RLS policies on `realtime.messages` scoping topic access by `auth.uid()` and the relevant membership table (workshop_participants, conversation participants, etc.).
3. **`relationship_edges` is publicly readable** — leaks the social graph (who interacts with whom, last interaction time) to anon. Restrict SELECT to rows where `auth.uid() IN (user_id, other_user_id)`.

**Should fix (warnings worth clearing):**
4. **Storage buckets missing SELECT policies**: `event-covers` (private bucket, currently unreadable → broken images) and `instant-whiteboard` (public bucket, no membership check). Add SELECT policies matching the existing instant-drive pattern.
5. **`group_event_lineup_slots` public visibility** — decide if public event lineups should be visible to RSVPed users or anon; current policy is host/claimant-only. If lineups are meant to sell the event, add a SELECT policy for safe columns on public events.
6. **`SECURITY DEFINER` view + executable functions** — the scanner flagged one error-level definer view and two warn-level definer functions executable by anon/authenticated. Audit each, REVOKE EXECUTE where not intended, or switch to SECURITY INVOKER.
7. **`extension in public` schema** — move to `extensions` schema (low risk, but a clean lint before launch).

I'll fix #1–#4 in one migration during implementation, audit #6 and act, and leave #5 as a product decision for you.

## 2. Auth hardening

- **Enable HIBP leaked-password check** — one toggle via `configure_auth`; blocks signups using passwords from known breaches. Standard pre-launch hygiene.
- **Confirm email auto-confirm is OFF** in production (sign-ups should require email verification before posting).
- **Password reset route** — verify `/reset-password` works end-to-end on the published domain (the route exists; smoke-test it).

## 3. SEO / discoverability

- Root metadata, robots, and sitemap exist and look good.
- **Run the SEO scanner** once and clear whatever fails. Most likely gaps: per-route titles/descriptions on the public surfaces that crawlers care about (`/`, `/gallery`, `/cities/$slug`, `/u/$username`, `/works/$slug`, `/g/$slug`, `/collab/$slug`, `/workshops/$slug`). Each leaf route should set its own title + description + og image (cover image when present).
- Confirm `sitemap.xml` includes dynamic rows (published works, public groups, city pages) not just static routes.

## 4. UI audit for real activity — site-wide

Scoped to the surfaces you flagged (gallery, workshop room, profile, auth/onboarding) plus the cross-cutting items that show up the first time the site has actual traffic.

**Gallery / discovery**
- Empty states for every filter combo (no results for city × category × sort) — currently can leave the user staring at nothing.
- "For You" tab fallback when the user has no signal yet (new visitors).
- Sticky filter bar behavior on mobile scroll; confirm the city combobox is reachable above the keyboard.
- Card density check at 1052px (your current viewport) — the cover/title/byline rhythm should feel calm, not crammed.

**Workshop room + tools**
- First-mic/cam permission prompt copy + a denied-permissions recovery path (today it can feel like a dead room).
- Tools panel: switching tools mid-session shouldn't blank the room; check the loading state.
- Recorder: persona switching with no personas present, and a clear "you are being recorded" indicator.
- Screen share: stop-share button visibility on mobile (often offscreen).
- "Live now" toast and PIP behavior across route changes — one regression here gets reported a lot once users notice.

**Profile / me pages**
- `u/$username` for an empty profile (no works, no collabs, no vouches) — needs a real empty state, not blank rails.
- `me.edit` validation feedback (handle taken, avatar upload failure).
- `me.tickets` and `me.collabs` empty + loading skeletons.
- Profile completion chip should actually link to the next missing step.

**Auth + onboarding**
- Onboarding step skip behavior — confirm users can finish later without getting trapped.
- Google sign-in success path: confirm the post-OAuth landing is the intended destination, not always `/`.
- First-run hints don't dismiss in a way that re-fires after a refresh.
- Mobile signup keyboard handling on the email/password step.

**Cross-cutting (the "real activity" lens)**
- 404 and error boundaries on every dynamic route — try `/u/nope`, `/works/nope`, `/g/nope`, `/collab/nope`, `/workshops/nope`. Each must render the route's notFoundComponent, not blank.
- Toast consistency — one variant for success, one for error, one for info; currently mixed.
- Tap targets on mobile nav and icon-only buttons (44×44 minimum).
- Single `<main>` per page and `aria-label` on icon-only buttons (accessibility blockers Lighthouse will flag).
- Loading skeletons (vs spinners) on the four highest-traffic routes: `/gallery`, `/`, `/workshop`, `/u/$username`.
- Image alt text on user-uploaded covers (fall back to title).
- Console + network error sweep on the published URL after deploy — anything red gets fixed before announcing.

## 5. Operational

- **Stripe**: confirm test-mode banner only shows in non-production and your live keys are in. The `payment-test-mode-banner` component is wired — verify the env flag.
- **Email**: confirm transactional email (auth, password reset, RSVPs) sends from a domain you control, not a Lovable default, if branding matters.
- **Custom domain**: `workshopindie.com` is connected. Re-publish after the security migration and smoke-test the four critical flows: sign up → onboarding → create a workshop → join a workshop from a second account.

## What I'll do on implement

1. One migration that fixes blockers #1–#4 (profiles PII, realtime RLS, relationship_edges, storage SELECT policies).
2. Audit and fix the SECURITY DEFINER view + functions (#6).
3. Enable HIBP leaked-password check.
4. Trigger the SEO scanner and add per-route `head()` on the public dynamic routes that come back failing.
5. Empty states + 404/error coverage sweep on the routes called out above.
6. Mobile tap-target + icon-button aria sweep.
7. Final smoke checklist against the published URL.

## Out of scope (call out before doing)

- Full performance pass (image sizing, route code-splitting, font subsetting).
- Analytics events.
- Onboarding tour rewrite.
- Branded Google OAuth consent screen.
- `group_event_lineup_slots` public visibility decision (#5) — needs your product call.