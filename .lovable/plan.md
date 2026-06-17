## Goal

Add an "Import from link" flow to the admin Events tab so you can paste an Eventbrite / Partiful / public event URL and get a pre-filled draft event to review, edit, and publish — instead of typing every field by hand.

## UX

In `src/routes/admin.events.tsx`, next to the existing **+ Create Event** button, add a second button: **Import from link**.

Clicking it opens a dialog with two steps:

1. **Paste URL**
   - Single URL input + "Fetch" button.
   - Helper text: "Works best with Eventbrite, Partiful, Luma, and most public event pages."
   - Loading state while scraping.
   - On error: inline message + a "Fill manually instead" link that opens the existing Create dialog.

2. **Review draft** (same form fields as Create Event, pre-filled)
   - Title, tagline, description, kind, format, cover image URL, starts_at, ends_at, timezone, venue name/address, online URL, capacity.
   - A small "Imported from {host}" chip + link back to the source.
   - **Group** picker is required (we can't infer which Workshop group it belongs to).
   - Each pre-filled field shows a subtle "AI-filled" hint that disappears once you edit it.
   - Buttons: **Save as draft** (status=`draft`) and **Publish** (status=`scheduled`, current behavior of `createEvent`).

No new tables. Uses existing `group_events` + `createEvent`.

## Technical

### Scraper server function

New file `src/lib/event-import.functions.ts`:

- `importEventFromUrl` — `createServerFn({ method: "POST" })` with `.middleware([requireSupabaseAuth])`, admin check via `has_role`.
- Input: `{ url: string }` (zod, http/https only, max 500 chars, basic SSRF guard: reject localhost / private IP hostnames / non-http(s) protocols).
- Handler:
  1. `fetch(url)` with a desktop User-Agent, 10s timeout, max 2MB body, follow redirects.
  2. Parse HTML and extract in this priority order:
     - **JSON-LD** `<script type="application/ld+json">` with `@type: Event` (Eventbrite, Luma, many others ship this). Pull `name`, `description`, `startDate`, `endDate`, `image`, `location.name`, `location.address`, `url`, `eventAttendanceMode` → format.
     - **OpenGraph / Twitter meta** as fallback (`og:title`, `og:description`, `og:image`, `og:url`, `event:start_time`, `event:end_time`).
     - **Site-specific light parsers** for Partiful (no JSON-LD): read `<title>`, `og:*`, and the `__NEXT_DATA__` script when present.
  3. Map to the same shape `createEvent` accepts:
     - `format`: `online` if `eventAttendanceMode` is `OnlineEventAttendanceMode` or only `online_url` present; `in_person` if address present; else `hybrid`.
     - `kind`: heuristic from title/description keywords (workshop → `workshop_irl`/`online`, listening → `listening_party`, screening → `screening`, mic → `open_mic`, else `other`).
     - `timezone`: from JSON-LD `startDate` offset when present, else `"UTC"`.
     - Strip HTML from description, cap at 6000 chars.
  4. Return `{ draft, source: { url, host, parser: "json-ld" | "og" | "partiful" }, warnings: string[] }`. Never write to the DB here — the dialog reuses `createEvent` after user review.

No new dependencies — use a small regex/`DOMParser`-free HTML scanner (string search for `<script type="application/ld+json">` blocks and `<meta property="...">` tags). Keeps the Worker runtime happy (no `cheerio`/`jsdom`).

### Client dialog

New component `src/components/admin-import-event-dialog.tsx`:

- Step 1 calls `importEventFromUrl` via `useServerFn`.
- Step 2 reuses the field layout from the existing `CreateEventDialog` form. Submits through the existing `createEvent` server fn (no schema changes).
- Adds a `status` toggle: "Save as draft" vs "Publish now". `createEvent` already defaults to `scheduled`; extend its zod schema with optional `status: z.enum(["draft","scheduled"]).optional()` and pass through in the insert. (Tiny edit in `src/lib/group-events-admin.functions.ts`.)

### Files touched

- **New**: `src/lib/event-import.functions.ts`, `src/components/admin-import-event-dialog.tsx`
- **Edit**: `src/routes/admin.events.tsx` (add button + dialog), `src/lib/group-events-admin.functions.ts` (allow `status: "draft"` on create)

### Out of scope (v1)

- Scraping ticket prices / RSVPs / attendee lists.
- Private/auth-gated event pages.
- Image rehosting — we keep the source `og:image` URL as `cover_url`. Can add Lovable storage upload later.
- Recurring events.
- Bulk import.

### Failure modes handled

- Non-200 fetch, HTML over 2MB, no parseable event data → return a clear error string; dialog shows it and offers "Fill manually".
- Private/local URLs blocked at the zod layer.
- Partial extraction is fine — the review step lets you fix anything missing before saving.
