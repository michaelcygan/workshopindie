# Event Import v1 Polish Pass (no external scrapers)

Three targeted upgrades. Scraper stays in-house — no Firecrawl, no third-party APIs. Bulk cap stays at 25.

## 1. Better in-house scraper

**Why:** Current scraper handles JSON-LD/OG well but misses Partiful/Eventbrite client-rendered pages.

**Approach (all server-side, zero new deps):**
- Add a real HTML parser pass in `src/lib/event-import.functions.ts` using `htmlparser2` (already transitively available; tiny, Worker-safe). No headless browser.
- Expand extraction order: JSON-LD `Event` / `EventSeries` → `og:*` / `twitter:*` → `<meta itemprop="...">` microdata → Eventbrite-specific `__SERVER_DATA__` blob → Partiful-specific `__NEXT_DATA__` blob → text heuristics.
- Both Eventbrite and Partiful ship full event payloads in inline `<script>` JSON (server-rendered, no JS execution needed). Parsing those gets us title, start/end, timezone, venue, cover, organizer, ticket URL on those two platforms.
- Strengthen recurrence detector: also read JSON-LD `eventSchedule` (RRULE-ish) when present.
- Show a "Source: eventbrite / partiful / generic" chip in the review dialog so I know which path ran.

## 2. Image rehosting

**Why:** External CDN URLs rot; published cards then 404.

**Approach:**
- Migration: create public storage bucket `event-covers` (public read, authenticated insert, owner update/delete).
- In `createEvent` and `createEventSeries`, when `cover_url` is external, server-side `fetch` → upload to `event-covers/<event-id>.<ext>` → swap `cover_url` to the storage public URL before insert.
- 5MB cap; allowed: `image/jpeg|png|webp|gif`. On any failure, keep the original URL — never block publish.
- Series: rehost once, share the storage URL across all N occurrences.

## 3. Server-side auto-cancel sweep

**Why:** Today the 3-report threshold only fires while an admin tab is open.

**Approach:**
- New server route `src/routes/api/public/events.report-sweep.ts`, secret-gated via `EVENT_SWEEP_SECRET` header (I'll prompt for the secret).
- Query `reports` where `entity_type='group_event'`, `reason='not_an_event'`, `resolved_at IS NULL`; group by event; any with ≥3 reports → cancel event (reuse existing `cancelEvent` logic via service role inside the handler) and mark reports resolved.
- Migration: pg_cron job hitting `https://project--<id>.lovable.app/api/public/events.report-sweep` every 15 min with the secret header.
- Admin-side toggle stays as redundant insurance.

## 4. Edit-future-in-series

**Why:** Editing one occurrence works; editing the whole future cadence requires cancel + re-import today.

**Approach:**
- On `g.$slug.e.$eventSlug.tsx`, when event has `series_key` and viewer is admin: show "Part of a recurring series" strip with **Edit this occurrence** and **Edit all future** buttons (+ **Cancel all future**).
- New server fns `updateEventSeriesFuture({ series_key, from_starts_at, patch })` and `cancelEventSeriesFuture({ series_key, from_starts_at })` — RLS-checked admin-only.
- "Edit all future" patches non-time fields by default (title, tagline, description, venue, cover, capacity, promo_pass_months). Time edits stay per-occurrence to preserve cadence.

---

## Files

**Edit:**
- `src/lib/event-import.functions.ts` — htmlparser2 pass + Eventbrite/Partiful inline-JSON extractors + source chip
- `src/lib/group-events-admin.functions.ts` — image rehost in `createEvent` / `createEventSeries`; add `updateEventSeriesFuture`, `cancelEventSeriesFuture`
- `src/components/admin-import-event-dialog.tsx` — source chip
- `src/routes/g.$slug.e.$eventSlug.tsx` — series admin strip

**Create:**
- `src/routes/api/public/events.report-sweep.ts`
- Migration: `event-covers` bucket + policies + pg_cron job

**Secret:** `EVENT_SWEEP_SECRET` (I'll request it via the secure form before wiring cron).

## Out of scope
- Headless browser scraping
- Third-party scraping APIs
- Bulk cap beyond 25
- Time-shift edits across an entire series
- Per-end-user OAuth

Ready to build on approval.
---
## v1 Polish Pass — Implemented (2026-06-18)

- Cover image rehosting: private `event-covers` bucket; createEvent/createEventSeries/updateEventSeriesFuture download external cover URLs and replace with a 5-year signed URL. On any failure, the original URL is kept.
- Server-side auto-cancel: `/api/public/events/report-sweep` cancels events with 3+ unresolved `not_an_event` reports; pg_cron runs it every 15 min. Marks reports as `action_taken`.
- Series-wide edits: `updateEventSeriesFuture` + `cancelEventSeriesFuture` server fns; new admin strip on the event detail page (Edit all future / Cancel all future). Time/cadence stay per-occurrence.
- Scraper upgrade: added Eventbrite `window.__SERVER_DATA__` and Partiful `__NEXT_DATA__` inline-JSON extractors. Source chip in review dialog shows which parser ran (`structured` / `eventbrite` / `partiful` / `og` / `fallback`).
