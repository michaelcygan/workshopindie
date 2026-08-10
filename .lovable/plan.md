# Workshop Groups — Mobile Scene OS (v1)

Rebuild the mobile presentation of an individual Group (`/g/$slug`) as a daily front page for a local scene. No new tables, no new primitives, no changes to permissions or moderation. Chicago is the launch case, reached by NFC card.

## What a visitor gets

A logged-out person who scans a card lands on Today and immediately sees: the scene's name and cover image, what is happening today (or the next thing coming up), a couple of open Collabs, recent work, and a quiet signal that a conversation is live — with no login wall. Signing in is asked for only when they try to participate.

## Section order (everywhere)

Today · Collabs · Events · Gallery · Blog · Members · Resources, then About, then Groups (only when child Groups exist).

- Members is hidden while logged out.
- Blog stays hidden with no eligible posts; Resources stays hidden with zero published entries (unchanged rule).
- Links, chat, news, and audio stop being tabs; they live inside Today.
- Visible labels change (Work → Gallery, Links removed from the bar) but internal tab keys (`work`, `posts`, `resources`, `subgroups`) and all `?t=` URLs keep working.

## Waves

### Wave 0 — Baseline
Capture mobile screenshots of `/g/chicago` at 320/375/390/430 logged out and signed in, and record the cold-load query/subscription count. No code change.

### Wave 1 — Mobile shell
- Image-led scene hero (~160–190px) using the existing `cover_url`, with avatar, name, tagline, member count, Join, Share, and compressed status badges. Neutral surface when there is no cover. The empty "Join audio" button leaves the hero.
- Rebuild the section bar in the order above: text labels, sticky under the hero, horizontally swipeable, 44px targets, plus an "All sections" menu at the trailing edge listing the same destinations with one-line descriptions.
- Suppress the global bottom island on the main Group route so there is one navigation system; the brand header remains the way back to Workshop.
- One shared top offset and one bottom clearance variable so the header, section bar, keyboard, and audio dock never overlap content.

### Wave 2 — Today and conversation
- One bounded server-side Today payload assembled from existing tables: live now, happening today (Event-timezone day boundaries), up to two open Collabs, up to four recent Works, up to two Blog posts, coming-up fallback, optional single news headline (no marquee). Every module hides when empty.
- Live conversation becomes a compact module inside Today that expands into a bottom sheet: no message bodies for logged-out viewers, read for signed-in non-members, full composer/presence/mentions for members. Existing `group_today_posts`, moderation, rate limits, and 24-hour expiry are untouched.
- Realtime subscriptions only for authenticated viewers with the conversation visible or open.
- Audio shows only when someone is connected; members can start it from the conversation sheet. Dock behavior preserved.

### Wave 3 — Section refinement
- **Collabs**: actionable cards (roles needed, location mode, timeline, compensation, creator, state) using the canonical Collab discovery rules instead of the local simplified selector.
- **Events**: Now / Today / This week / Later ordering, compact 72–88px rows, filters collapsed into one sheet, Event-timezone formatting.
- **Gallery**: true two-column image grid from 320px, honest recency ordering (drop the fake "Trending").
- **Blog**: two labeled blocks — tagged to this scene, then from members — with one batched read replacing the first-30-members fan-out.
- **Members**: signed-in only, searchable privacy-safe list, stewards first then deterministic order, Message only where existing eligibility allows.
- **Resources**: dense list with optional image when `image_url` exists; model, ordering, admin CRUD, and hidden-when-empty untouched.
- **About** and conditional **Groups** built from existing data only.

### Wave 4 — Correctness and performance
- Remove the unused `nextEvent` query on the route.
- Consolidate the Blog/Resources tab-visibility reads into one small availability payload; lazy-load inactive section bodies.
- Every Event summary resolves through `event_groups`, never primary `group_id` alone.
- Fix `group-next-event.tsx` linking to `tab=events` when the route reads `t=events`; clean stale `?t=` values for unavailable sections back to Today.
- Apply blocked-user filtering and canonical visibility predicates on all Group projections; lazy-load and size below-fold images.

### Wave 5 — NFC and regression
- Configure Chicago NFC destinations with the existing `/go/$slug` tracking links (not `?j=` seed links) and verify a clean logged-out redirect with attribution intact.
- Typecheck, tests, production build, plus a walkthrough of every role, `/g/$slug/events`, Event/Collab/Work/Blog detail, Join/Leave, audio, and unlisted Groups.

## Technical notes

- No migration. All modules read from `groups`, `group_members`, `event_groups`/`group_events`, `group_collabs`/`collab_posts`, `group_works`/`works`, `blog_post_entity_tags`/`blog_posts`, `group_resources`/`resources`, `group_today_posts`, and existing presence/audio tables. If something appears to need a new table, I stop and explain first.
- New code is a Today view-model server function plus a small availability helper; existing `*.functions.ts` files stay the canonical write paths.
- Desktop (`md+`) changes only where required for correctness or shared labels.
- RLS, moderation pipeline, rate limits, tracking, and canonical URLs are unchanged.

## Out of scope

Standalone directory, maps, resource filters/reviews/submissions, new feed or Group post type, anonymous chat, push/native/proximity, algorithmic feeds, taxonomy changes, and any redesign of global Workshop surfaces.
