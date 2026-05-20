## Workshop — Updated v1 Launch Plan (DMs promoted to P0)

Incorporates your feedback: Cloudflare finish, media fallback, Google sign-in, no email verification gate, **mutual-follow DMs at launch**, in-app notifications, welcome tour, mandatory home city + geo home feed, 14-day trial, comp-membership invite links. Weekly digest stays v2.

---

### P0 — Launch blockers

1. **Finish Cloudflare wiring.** Worker is deployed but not acting as a CDN layer.
   - Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` response headers to public read server fns (gallery, collab index, workshops index, city pages, work detail, profile, OG image).
   - Confirm R2 / Supabase Storage CDN headers for `avatars`, `covers`, `work-covers`, `instant-whiteboard` (long max-age + immutable; cache-bust via filename).
   - Single biggest scale lever before launch.

2. **Media bandwidth fallback (video / audio).** Upload → Cloudflare Stream (best fit, you're already on CF) returns HLS manifest. New `media_assets` table (`work_id`, `kind`, `hls_url`, `mp4_fallback_url`, `duration_s`, `bytes`, `status`) so providers can swap without a schema change. Replace raw `<video>` in `embed-player.tsx` with HLS.js + native Safari fallback. Existing YouTube/Vimeo/SoundCloud embeds untouched.

3. **Google sign-in.** Add "Continue with Google" to `login.tsx` and `signup.tsx` via `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. Same turn: call `configure_social_auth` with `providers: ["google"]`. Keep email/password as secondary.

4. **Auth flow polish (no email-verification gate).** Call `configure_auth` with `auto_confirm_email: true`. Enable `password_hibp_enabled: true`. Add `/reset-password` route + "Forgot password?" on `login.tsx`. Verification email still sends but isn't required.

5. **Welcome / Quickstart tour.** 4-step bottom sheet on first login (persist `profiles.tour_completed_at`):
   1. Pick home city (required — see #6)
   2. Add profile pic + headline
   3. Drop into a live Lounge (one-tap join the fullest medium-matched room)
   4. Post a Collab or import your first Work
   Persistent "Finish setup (2/4)" pill in top nav until done.

6. **Mandatory home city.** Migration → `profiles.home_city_id NOT NULL` after backfill. Server fn `inferCityFromIp` using `cf-ipcountry` + `cf-iplatitude` / `cf-iplongitude` headers to suggest nearest city in `cities`. User confirms in the tour. Default home feed (#7) breaks without this.

7. **Geo-default home / gallery / collab / workshops feed.** For signed-in users default `city_id = home_city_id` with a "Worldwide" toggle. For anonymous: use CF geo headers + nearest-city lookup with a "Showing {city} — change" banner.

8. **Notifications (in-app).** New `notifications` table (`user_id`, `kind`, `actor_user_id`, `entity_type`, `entity_id`, `payload jsonb`, `read_at`, `created_at`), RLS scoped to `user_id`, realtime subscription. Triggers / server fns insert on: new follower, comment on your work, like, collab application received / accepted, workshop confirmation, **new DM**, payment receipt, payment failed, comp-link claimed. Wire `notifications-bell` to this table. Email mirror deferred to v2.

9. **DMs — mutual-follow only (PROMOTED to P0).**
   - Tables:
     - `conversations (id, user_a uuid, user_b uuid, last_message_at timestamptz, created_at timestamptz)` with `CHECK (user_a < user_b)` invariant + `UNIQUE (user_a, user_b)`.
     - `messages (id, conversation_id, sender_id, body text, created_at, read_at)`.
   - SECURITY DEFINER fn `can_dm(_a uuid, _b uuid) returns boolean` — true iff (a) mutual follow exists in both directions in `follows`, OR (b) the two users share a row in `work_credits` / `workshop_participants` / accepted `collab_invites`.
   - RLS:
     - `conversations` insert allowed only if `can_dm(user_a, user_b)`; select if `auth.uid() in (user_a, user_b)`.
     - `messages` insert allowed if sender is a participant AND `can_dm()` still holds (so unfollow doesn't allow new messages, but history stays); select if participant.
   - Routes: `/dms` (conversation list with last message + unread count), `/dms/$conversationId` (thread, realtime on `messages`).
   - "Message" button on profile / work / collab cards is only enabled when `can_dm()` returns true; otherwise shows tooltip "Follow each other to send a message."
   - Block respects `user_blocks` — blocked users can't `can_dm`.
   - Insert into `notifications` on each new DM.
   - `messages.body` length-capped (e.g. 2000 chars), `report_dialog` accepts `entity_type='message'`.

10. **Auth-gating layout (`_authenticated`).** Create `src/routes/_authenticated.tsx` with `beforeLoad` redirect to `/login?redirect=…`. Move `me`, `me.edit`, `works.new`, `collab.new`, `workshops.new`, `onboarding`, `checkout.return`, `admin/*`, **`dms.*`** under it. Stops protected-content flash + removes per-page auth checks.

11. **SEO essentials.** `head()` on dynamic routes (`works.$slug`, `workshops.$slug`, `u.$username`, `cities.$slug`) with loader-derived title/desc/og:image (cover_url / avatar_url / city hero). Replace hardcoded preview-URL og:image in `__root.tsx` with `/og-default.jpg`. Add `/robots.txt` and `/api/public/sitemap.xml.ts` (published works, profiles, workshops, collabs, cities). JSON-LD: `Person` / `CreativeWork` / `Event`.

12. **Rate-limit hot mutations.** `rate_limits` table + `check_and_bump(action text, key text, window_s int, max int)` SECURITY DEFINER. Apply to: `createCheckoutSession`, follow, comment insert, work create, collab post create, workshop create, report, **DM send**.

13. **Stripe — 14-day free trial + comp invite links.**
    - `subscription_data: { trial_period_days: 14 }` on `plus_monthly` checkout.
    - `invoice.payment_failed` → notification + grace UI in `/me`.
    - `comp_memberships (code text unique, granted_by uuid, granted_to uuid nullable, duration_months int default 12, status text, created_at, redeemed_at, expires_at)`.
    - `/redeem/$code` route → `redeemCompMembership` server fn that upserts a `subscriptions` row (`tier='plus', status='active', current_period_end = now() + duration, stripe_subscription_id = null`) and marks the code redeemed.
    - Admin panel: bulk-generate codes, copy-to-clipboard, see redemptions.
    - `usePlus` already treats any active+tier=plus row as Plus, so this just works.

14. **Webhook idempotency.** `processed_stripe_events (event_id text primary key, processed_at timestamptz)`. Webhook returns 200 if already seen.

15. **Strip 55 `as any` casts.** Regenerate Supabase types, remove all. Each is a future runtime error.

16. **Error reporting.** Confirm `src/lib/error-capture.ts` is wired to Sentry (or equivalent) before launch.

### P1 — Within 2 weeks of launch

17. **Keyset pagination.** Replace `.limit(12)` with `order by published_at desc, id desc` + `.lt('published_at', cursor)` across gallery, profile tabs, collab index, workshops index, city feeds.
18. **Push public reads off client into server fns** — one place for cache headers + future read-replica routing.
19. **Annual Plus price** (`plus_yearly`, ~$49, 2-month discount).
20. **Refactor big components.** `channel-view.tsx` (742), `room-board.tsx` (709), `media-panel.tsx` (658), `workshops.$slug.tsx` (584) → 3-4 files each.
21. **Analytics.** PostHog: signup funnel, time-to-first-work, time-to-first-collab, lounge minutes, Plus conversion, trial→paid, comp-redeem rate, **DM send / reply rate**.

### P2 — Scale path

22. Move `instant_presence` heartbeats to a Cloudflare Durable Object before ~5k concurrent. Realtime chat stays on Supabase.
23. Replace counter triggers with `counters_pending` queue + nightly recompute around 100k MAU.
24. Read replica + connection pooling at the next Cloud tier; route public reads there.
25. Email digest (deferred per your note — wire when there's enough on-page activity to make it worth opening).

### Deliberately NOT in this plan
- Email verification gate
- Weekly digest emails (v2)
- Custom-named lounge rooms
- Formal soft-launch / waitlist (replaced by comp invite links)

---

### Execution order

```text
Day 1   #1 Cloudflare cache headers, #3 Google sign-in, #4 auto-confirm + HIBP,
        #10 _authenticated layout, #15 drop as any
Day 2   #2 HLS media fallback (biggest unknown — do early)
Day 3   #5 welcome tour, #6 mandatory city + IP infer, #7 geo home feed
Day 4   #8 notifications, #9 DMs (mutual-follow), #12 rate limits, #13 trial + comp links
Day 5   #11 SEO + sitemap + robots, #14 webhook idempotency, #16 Sentry, smoke test, LAUNCH
Week 2  P1 #17–21
Week 3+ P2 as scale demands
```

Each step is independently shippable and live-safe. Approve and I'll start with #1 (Cloudflare cache headers) and #3 (Google sign-in) in parallel.
