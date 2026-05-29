# Ship-Readiness Audit — v2

No broken routes, no 404s. Every static `<Link to=…>` resolves. Auth, notifications, follows, DMs, share sheet, redeem codes, badges, realtime — all wired. Platform can ship as-is. This is the polish + stickiness pass.

---

## A. Fix — paper cuts

1. **Follow notifications go to your own profile.** `src/components/notifications-bell.tsx:41` routes follow notifications to `/me` instead of the follower. Include `actor_username` in the notification payload (check `notifications.functions.ts` emit site) and route to `/u/$username`.

2. **Surface scheduled workshops inside the existing Workshop tab — no new nav item.** Keep the top-nav and mobile-nav exactly as they are (`Workshop` → `/instant`). Inside `src/routes/instant.index.tsx`, add a clean toggle / segmented control at the top:

   - **Live now** (the current default — instant rooms, drop-in)
   - **My upcoming** (workshops the user has RSVP'd to, ordered by `starts_at` ascending; shows host, time, city/online, "Join" when within join window, otherwise "Remind me")

   Hidden when signed-out. Empty state: "No RSVPs yet. Browse from a profile or city page." `/workshops` keeps working as a destination from cards and profiles — this just makes the user's own queue first-class.

3. **Workshop going live — two surfaces:**

   - **Notification drawer row.** New notification kind `workshop_starting`, fired when a workshop the user RSVP'd to flips into its join window (≈5 min before `starts_at`). Wire the emit into the existing `api/public/workshops.sweep.ts` cron route (it already runs on a schedule). Title: "{Workshop title} is starting now". Click → the workshop room.
   - **Bottom-right live bubble.** A new lightweight component `WorkshopGoingLiveToast` mounted in `__root.tsx`. Subscribes (Supabase Realtime) to `notifications` for the current user filtered to `kind = 'workshop_starting'`. When one arrives, it slides in for ~60 seconds with: workshop title, host avatar, "Join now" button. Dismissible. Appears once per workshop (dedupe by `entity_id` in localStorage). Doesn't fire if the user is already inside that workshop room.

   No new infra — uses the existing notifications table, existing realtime channel, existing cron sweep.

4. **Privacy stub on `/me/edit`.** `src/routes/me.edit.tsx:558` shows "More granular privacy controls coming soon." with no controls. Remove the section.

5. **Profile copy stub.** `src/routes/u.$username.tsx:844` "More group types coming soon." — trim the futures promise, keep just the section header.

6. **Delete dead code.** `src/components/coming-soon.tsx` is imported nowhere. Remove.

7. **Verify `/checkout/return` origin.** Read-only check that `stripe-embedded-checkout.tsx` `return_url` resolves to `workshopindie.com` in production, not the preview URL.

---

## B. Stickiness & retention — cheap wins

8. **Universal share sheet.** Generalize `share-collab-sheet.tsx` to a `ShareSheet` primitive and add a share button to:
   - `works.$slug.tsx`
   - `workshops.$slug.tsx`
   - `u.$username.tsx`

   Each share writes to a new lightweight `share_events` table (one migration: `entity_type`, `entity_id`, `channel`, `user_id`, `created_at`, public insert / owner read). Biggest virality unlock — works/workshops are what people want to brag about; only collab has a share button today.

9. **Referral attribution.** Read `?ref=<username>` on `/signup`. Add `referred_by uuid` to `profiles` (single migration). On signup with a valid `ref`, populate it and emit a `referral_joined` notification to the referrer. Add an "Invite friends" card on `/me` that copies `https://workshopindie.com/?ref=<my-username>`. No paid incentives — attribution + acknowledgement only.

10. **Empty-state CTAs.** Currently blank surfaces a new user lands on:
    - `/dms` empty → "No conversations yet. Find people on the Collab Board → message them." → `/collab`
    - Notifications dropdown empty → "Quiet for now. Follow someone or post a collab."
    - `/me` "Your Works" empty → "You haven't shipped yet. Start a Workshop or publish from a Collab."

    One primary button per empty state.

11. **Profile completion chip on `/me`.** Single dismissible chip at the top: "Finish your profile (1/3 done)" if the user is missing avatar, city, or first work. Click → `/me/edit`. Drives activation without a heavy modal — `welcome-tour` already covers first run.

12. **"Just shipped" trigger.** When a user publishes their first Work: fire a notification to every follower AND auto-DM workshop collaborators a celebratory line. Credits + DM primitives already exist; this just wires the publish event into both. Biggest moment-of-pride on the platform — currently silent.

---

## C. Things to NOT add

To stay on the ship-as-is path: no push notifications, no email digests, no additional OAuth providers, no comments/reactions beyond what exists, no referral rewards (attribution first).

---

## Suggested execution order

**Pass 1 — polish + workshop live signals (one mergeable commit):** 1, 2, 3, 4, 5, 6, 10. Item 7 is a 30-second read-only check.

**Pass 2 — stickiness, one verifiable feature at a time:** 8 (share sheet), then 11 (profile chip), then 9 (referrals), then 12 (publish celebration).

Say "approved" and I'll execute Pass 1 first.
