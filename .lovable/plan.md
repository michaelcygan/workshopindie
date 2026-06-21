# Workshop pre-launch audit — pores, SEO/AI, scale, cleanup

This is a multi-track plan, not one feature. Pick which tracks to ship now and which to defer; I'll execute each separately.

## What's already strong (don't touch)

- Logged-out posture per `.lovable/logged-out-strategy.md` is healthy: detail pages public, `JobPosting` JSON-LD on Collabs, `Event` on Workshops, `CreativeWork` on Works, `Person` on Profiles. `guest-apply-dialog` + `claim_token` + `backfill_guest_applications_on_signup` trigger already convert anonymous Collab applications.
- `event-rsvp-auth-sheet` + `setPendingRsvp` already resumes RSVP after signup.
- Sitemap covers works, profiles, workshops, collabs, cities. `robots.txt` correctly disallows private surfaces.
- Per-route `head()` + JSON-LD on the major public types is in place.

## Track 1 — Logged-out conversion pores (highest ROI for launch)

Tasteful prompts where value has been delivered. Each follows the canonical handoff: prefill, claim token where there's data, never block read.

1. **Landing page logged-out variant** (`src/routes/index.tsx`). Today it renders the signed-in feed for everyone. Split into `LoggedOutHero` (currently only used on `/gallery`) + a curated **public rail set**: live Workshops, fresh Collabs, featured city. Replace `NetworkRail` / `UpcomingInMyGroupsRail` with social proof rails for guests. CTA card under each rail: "Follow @creator for new work" → opens `SignupGateModal` prefilled with the action.
2. **Save / follow gates** — Works, Profiles, Collabs already have like/save/follow buttons but they require auth. Wire each to `SignupGateModal` with action-specific copy ("Save this work to your portfolio", "Get notified when {name} posts"). Persist the intent in sessionStorage and replay after signup (same pattern as `pending-rsvp`).
3. **Workshop "remind me" guest flow** — `/workshops/$slug` has no analogue to RSVP for guests. Add a "Remind me" pill that captures email into a new `workshop_reminders(workshop_id, email, claim_token, created_at)` table, mirrors the Collab claim flow, and converts on signup via a trigger.
4. **Inviter attribution everywhere** — `?via=<username>` is mentioned in the strategy doc but not consistently injected by share sheets. Audit `share-sheet.tsx`, `event-share-sheet.tsx`, `share-collab-sheet.tsx` to always append `via` when sharing, and surface "via @name" on the receiving page's signup CTA.
5. **Empty-author conversion** — when a logged-in user lands on a Profile / Work / Collab they don't follow, show a one-line "+ Follow" inline; for guests the same surface reads "Sign up to follow."

## Track 2 — SEO + AI findability

1. **Sitemap index split**. `src/routes/sitemap[.]xml.ts` returns one file capped at 5K profiles + 5K works; at 100K DAU that truncates. Convert to a sitemap index pointing at `/sitemap-works.xml`, `/sitemap-profiles.xml`, `/sitemap-collabs.xml`, `/sitemap-workshops.xml`, `/sitemap-cities.xml`, each paginated 50K/file. Cache `s-maxage=3600`.
2. **Switch sitemap from `supabaseAdmin` → publishable client** with `TO anon` SELECT on the columns used (`published_at`, `slug`, `username`). Same for `seo-loaders.functions.ts`. Service role at the request boundary for read-only public data is both a perf concern (no PostgREST caching) and a blast-radius concern.
3. **JSON-LD coverage gaps**: add `CollectionPage` + `BreadcrumbList` on `/cities/$slug`, `/gallery`, `/collab` (list), `/workshops` (list); add `ItemList` to the rails on the city page. These are what Google uses to render rich list snippets.
4. **`/llms.txt`** — a static `public/llms.txt` describing Workshop's primitives (Workshops, Collabs, Works, Profiles), key URLs, and how to query them. ChatGPT / Claude / Perplexity crawlers read this first. Cheap, high-leverage for AI search.
5. **Verify canonical/og:url self-reference** on every public route (`head-meta` rule). One pass with a script.
6. **OG image generation** — current public routes use the cover image when present, fall back to none. Confirm `og:image` is always set on Collab/Work/Workshop/Profile/City when one exists.

## Track 3 — Backend at 100K DAU

1. **`profiles.last_active_at` write-hot path**. `PresenceHeartbeat` updates `profiles` on a timer — at 100K DAU that's profile-row contention and index bloat. Move to a thin `user_presence(user_id PK, last_seen_at)` table, write there, read joined where needed. Keep `last_active_at` as a backfilled denorm if anything reads it directly.
2. **View / popularity counters** — `works.view_count` / `popularity_score` and `room_views` should be increment-batched (queue → trigger every N minutes) rather than per-pageview UPDATE. Confirm `popularity_score` has its own index and is recomputed by cron, not on read.
3. **Index audit on hot read paths**. Verify composite indexes for:
   - `collab_posts (status, created_at desc) where status='open'`
   - `works (status, visibility, published_at desc)`
   - `workshops (status, scheduled_start_at)`
   - `profiles (lower(username))`, `(lower(email))` for guest-claim trigger
   - `group_events (group_id, starts_at)`, `(starts_at) where status='published'`
   - `follows (follower_user_id, followed_user_id)`
4. **Realtime channel hygiene** — `use-media-room`, `channel-view`, `chat-polls` each open per-room channels (correct). Confirm we unsubscribe on unmount and don't re-subscribe on each render. Set Supabase Realtime quotas in plan.
5. **`supabaseAdmin` audit** — 354 call sites. Tag each by category (admin tools, webhooks, public reads). The webhook + admin uses are correct; the public-read uses move to publishable + RLS in Track 2.
6. **Edge caching headers** on every public GET route (`s-maxage=60, stale-while-revalidate=300` for detail pages; `60/600` for lists). The Worker honors these in front of Cloudflare's POP cache.

## Track 4 — Pre-launch cleanup

1. Delete stale stub routes if no inbound links: `me.blocked.tsx` is now a `<Navigate>` to `/settings` — keep (stable URL). Audit `me.friends.tsx`, `workshop.tsx` / `workshop.index.tsx` overlap.
2. Sweep `// eslint-disable-next-line @typescript-eslint/no-explicit-any` — most can be typed properly now that schemas are stable.
3. Confirm Stripe environment is set to **live** for launch (`payment-test-mode-banner.tsx` should not appear on prod).
4. Update `mem://security-memory` after Track 2/3 land (publishable-key reads + new presence table).
5. Run an SEO scan via `seo_chat--trigger_scan` once Track 2 lands, then mark findings fixed.
6. Verify every CTA reachable from the logged-out hero opens `SignupGateModal` (never a hard redirect to `/signup`) so the user keeps page context.

## Suggested execution order

1. Track 1 (#1, #2) — biggest conversion lift, ship first.
2. Track 2 (#2, #1, #4) — switch admin→publishable for sitemap + loaders, split sitemap, add llms.txt.
3. Track 3 (#1, #3) — presence table + index audit.
4. Track 1 (#3, #4, #5) + Track 4 polish + SEO scan.

## What I need from you

Which tracks do you want me to start with? Reasonable defaults if you say "go":
- **Track 1 #1 + #2** (landing page logged-out variant + save/follow gates) this turn
- **Track 2 #4** (llms.txt) bundled in — it's a one-file add

The rest I'll plan and ship in follow-up turns. Anything to drop or reprioritize?
