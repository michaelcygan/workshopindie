# Tracking URL Builder + Tracking Link Analytics

A small first-party acquisition primitive: name a placement, get a Workshop URL, measure visits.

`Empty Bottle Poster` → `workshopindie.com/go/empty-bottle-poster` → instant redirect to `/events/chicago-songwriters-night`.

## What I found in the repo

- `/admin/links` today stacks two independent panels: group seed links (`GroupSeedLinksPanel`) and the Workshop-room `/w/:token` builder. Tracking links become a third, fully separate panel. Neither existing system is touched.
- Admin server functions follow one pattern: `requireSupabaseAuth` middleware → `requireAdmin()` role check → `supabaseAdmin` for the query. Analytics pages read pre-built `vw_*` SQL views through the `panel()`/`isOk()` envelope helpers.
- The Growth funnel's "Share-link visits" step counts rows in `share_events` — in-app share button presses, a different thing entirely from promotional link clicks. **The funnel will not change.** Tracking links get their own section, no double-counting.
- Cloudflare geo headers are already used in `src/lib/geo.functions.ts` (`cf-iplatitude`, `cf-iplongitude`, `cf-ipcountry`), with a `nearest_active_city` database function doing the city math. Tracking-link geo reuses exactly this — no new third-party service.
- `qrcode` and `@types/qrcode` are already installed.

## How member vs guest gets recorded

Sessions live in browser storage, so the redirect request itself cannot know who the visitor is. Rather than delay the redirect, the click is written immediately as `guest`, and the redirect carries a short-lived click id. Once the destination page loads, a tiny background ping upgrades that row to `member` if a session exists. The visitor sees nothing and waits for nothing; the number settles within a second. Only the member/guest flag is stored — never which member.

## Waves

### Wave 1 — Database
Migration creating:
- `tracking_links` — `slug` (unique), `name`, `destination_path`, `created_by`, `is_active`, timestamps.
- `tracking_link_clicks` — link id, `visitor_type` (`member`/`guest`), `city`, `region`, `country`, `referrer`, `clicked_at`. No IP addresses, no user id, no fingerprint.
- Indexes on `(tracking_link_id, clicked_at)` and `clicked_at`.
- RLS: admins manage everything; the public gets no direct read or write — all recording happens through trusted server code.
- Grants per repo convention.

### Wave 2 — Redirect + recording
- Public server route `/go/$slug` returning a real HTTP redirect (no page render, no flash).
- Resolves the link, writes one click, redirects — preserving any query params the visitor arrived with.
- Coarse geo from Cloudflare headers via the existing nearest-city helper; null when unavailable, never fabricated.
- Referrer host only (e.g. `instagram.com`), not full URLs.
- Unknown or disabled slug → Workshop's normal not-found behavior.
- Obvious bots and health checks skipped by user-agent.
- Small public server function to upgrade a click to `member`, plus the root-level ping that calls it.

### Wave 3 — Admin builder on `/admin/links`
New "Tracking links" panel beneath the existing ones:
- Name (required, 120 chars), Destination (required), optional editable Slug that auto-fills from the name.
- Destination validation: internal paths only. Full `workshopindie.com` URLs are normalized to their path; outside domains rejected; `/go/...` destinations rejected to prevent loops. This cannot become an open redirect.
- Slug normalized (lowercase, hyphens, no duplicates/junk) and uniqueness handled with a clear message, not a crash.
- List below: Name · tracking URL · destination · clicks · created · active toggle · actions (Copy, QR, Open). Soft-disable only, no deletion — click history is preserved.
- Empty state: "Create a tracking link to measure traffic from a campaign, QR code, NFC card or physical placement."

### Wave 4 — QR
Small dialog per row rendering the QR with the installed `qrcode` package, plus download PNG and copy link. Nothing more.

### Wave 5 — Analytics aggregation
Two SQL views following repo naming:
- `vw_tracking_link_stats` — per link: clicks, member clicks, guest clicks, top location, first click, last click, destination, active flag, windowed by 7/30/90/all.
- `vw_tracking_link_daily` — per link per day, for the optional trend.
Aggregation happens in the database, never by pulling click rows to the client.

### Wave 6 — Growth section
"Tracking links" section on `/admin/growth` using the existing table, card, and period-control styling:

| Link | Clicks | Members | Guests | Member % | Top location | First | Latest | Destination |

Sorted by clicks. Period control (7 / 30 / 90 / All). Empty state: "No tracking-link visits yet. Create a link in Admin → Links and use it anywhere you promote Workshop." A per-link daily trend is included only if it stays trivial.

### Wave 7 — Hardening + verification
Open-redirect attempts, loop protection, slug collisions, missing geo, missing referrer, disabled links, mobile admin layout, redirect latency, RLS probes as an anonymous visitor, and typecheck/tests. End-to-end check of the acceptance flow: create → copy → QR → visit logged out → visit logged in → see 1 member / 1 guest → disable → re-enable. Regression check that `/w/:token`, group seed links, and the existing Growth funnel are unchanged.

## Out of scope
Unique-visitor logic, conversion/signup attribution, UTM engine, campaign management, external redirects, large chart dashboards.
