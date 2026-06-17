## Audit of the import flow (v1 scope)

Three additions, all small, all reusing existing tables (`group_events`, `reports`, `notifications`). No new tables — that keeps it durable at scale and reversible.

---

### 1. Recurring events

**Detection (server-side, in `event-import.functions.ts`):**
- JSON-LD `EventSeries` / nested `subEvent` array → use those dates directly.
- Plain-text heuristic on title + description: regex for `every (Sun|Mon|…)day`, `weekly`, `bi-?weekly`, `every other`, `monthly`, `first/last <weekday> of the month`.
- If matched, return an extra field on the draft: `recurrence: { rule: "WEEKLY" | "BIWEEKLY" | "MONTHLY", weekday: 0–6, hint: "every Sunday" } | null`.

**UX in the review dialog:**
- New "Repeats" row appears when recurrence is detected (or admin can toggle it on manually):
  - Pattern dropdown: One-time / Weekly / Every 2 weeks / Monthly
  - "Generate next N occurrences" number input (default 8, max 26)
  - "Until" optional date
- "Auto-filled" sparkle on the Repeats row if detection found it.

**Storage approach (no schema change):**
- On submit, generate N occurrence rows in one `createEvents` call (new server fn that loops `createEvent`'s insert logic in a single transaction). Each row gets a `series_key` stored in a new lightweight TEXT column `series_key` on `group_events` (small migration: add nullable column + index). That lets the admin filter/bulk-cancel a whole series later.
- Drafts (`status='draft'`) just store the parent; series materializes on Publish.

**Why this and not RRULE in one row:** every other page in the codebase (event detail, RSVP, ICS, sweep job, notifications) reads `starts_at`/`ends_at` as a single instant. Materializing rows means zero changes to those code paths. `series_key` is the only new field.

---

### 2. "Report non-event" + admin alert (with auto-cancel option)

**User side:**
- On the event detail page, add a small "Report" link (uses existing `reports` table with `entity_type='group_event'`, new `reason='not_an_event'`). No new endpoint — `submitReport` already exists.

**Admin side (top of `/admin/events`):**
- A dismissible alert strip listing any event with ≥1 unresolved `not_an_event` report:
  - "{title} — 3 reports" · [View] [Cancel event] [Dismiss reports]
- "Dismiss reports" marks them resolved (existing `reports.status` column) without touching the event.
- "Cancel event" calls existing `cancelEvent`.

**Auto mode (per-admin toggle, stored in `localStorage`):**
- Checkbox in the alert header: "Auto-cancel after 3 reports."
- When ON, the page-level effect runs once per event: if reports ≥ threshold and not yet canceled, call `cancelEvent` and toast "Auto-canceled {title}." Threshold (3) is hard-coded for v1.
- Stays client-side for v1 — no cron, no server policy. Keeps the trust model: a human admin tab must be open for an auto-cancel to fire. We can promote it to a server cron later without changing the UI.

---

### 3. Bulk import from a list of links

**UX:** In the Admin Events tab, the "Import from link" dialog gets a second tab: **Bulk**.
- Textarea: paste one URL per line (also accepts comma- or newline-separated; trims/dedupes).
- Optional: a single Group picker that applies to all (since you'll usually batch by group); per-row override available in the review step.
- "Fetch all" → server function `importEventsFromUrls({ urls: string[] })` with:
  - Zod cap at 25 URLs per call.
  - Sequential fetch with 3-way concurrency (`Promise.all` over chunks of 3) to be polite.
  - 10s timeout per URL (already in place); per-URL failures don't fail the batch — they come back as `{ url, error }`.
- Result screen: a compact queue list, one row per URL with status chip (`Ready` / `Needs date` / `Failed`), the imported title, and an **Edit** button that opens the existing single-event review dialog pre-filled.
- Group-level actions: **Publish all ready** (only rows with title + starts/ends + group), **Save all as drafts**, **Discard failed**.

**Safety rails:**
- Admin-only middleware (already enforced).
- The same SSRF guard applies per URL.
- Server fn returns drafts only — never writes. All inserts go through the existing reviewed `createEvent` so RLS, slug generation, and notifications stay consistent.

---

### Files touched

**New**
- `src/components/admin-import-bulk.tsx` — the bulk tab + queue list.

**Edited**
- `src/lib/event-import.functions.ts` — add recurrence detection, add `importEventsFromUrls`.
- `src/lib/group-events-admin.functions.ts` — add `createEventSeries` (loops inserts with shared `series_key`).
- `src/components/admin-import-event-dialog.tsx` — add tabs (Single / Bulk), add Repeats row in review step.
- `src/routes/admin.events.tsx` — add the dismissible reports alert strip + auto-cancel toggle.

**Migration**
- Add nullable `series_key text` to `group_events` + index. No RLS changes; grants unchanged.

---

### Explicitly out of scope (v1)

- True RRULE engine / "edit this and all following" semantics.
- Server-side auto-cancel cron (client-only for v1).
- Image rehosting from source pages.
- Importing tickets, prices, or attendee lists.
- Auth-gated event pages (Eventbrite private, Facebook, Meetup behind login).
- Bulk imports over 25 URLs in one shot (paginate by running it twice).

### Why this is still v1-shaped

- One new nullable column, no new tables.
- Reuses existing `reports`, `notifications`, `cancelEvent`, `createEvent`.
- All AI/heuristic work runs once at import time, then becomes plain rows — no runtime cost per page view.
- The auto-cancel sits client-side so we avoid a cron + trust audit until the feature proves useful.
