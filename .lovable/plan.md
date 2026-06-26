# Finalize the Events page

Bring `/events` in line with the Collab Board: tighter header, inline city filter, and a "Near you" hint that matches the look of the screenshot.

## 1. Header — match Collab Board height

In `src/routes/events.index.tsx`:

- Replace the current stacked header (kicker chip on its own row + large paragraph on its own row) with the Collab Board's single meta-row pattern:
  - `PageHeaderCompact` (title + "Host an event") — unchanged.
  - One `mt-3 flex flex-wrap items-center gap-2` row holding:
    - `<KickerChip live={happeningCount > 0}>` ("N happening now" / "On the calendar")
    - Short tagline inline as `<p className="text-sm text-ink-muted">` (trimmed to one line, e.g. "Networking, listening parties, work-in-progress nights — RSVP unlocks a free trial.")
    - Right-aligned `ml-auto` pill: `{list.length} {when}`.
- Drop the standalone `RecapChip` and the big two-line paragraph block. Net effect: header collapses from ~3 rows to 1 row + meta row, matching the Collab Board's vertical rhythm.

## 2. Filter row — add city filter inline

- Add `city` + `cityName` to a new `validateSearch` schema (matches Collab Board: `city: uuid().optional()`, `cityName: string().optional()`, plus existing `when`/`format` migrated from `useState` to URL search per project routing conventions).
- Move `when` and `format` into URL search (`useNavigate` setters) so deep-links work.
- New filter row layout (single `flex flex-wrap items-center gap-2`):
  - `When` SegToggle (Upcoming / Past)
  - `Format` SegToggle (All / In person / Online)
  - `<EventsCityCombobox />` — a slim copy of the Collab Board `CityCombobox` (search input → cities table → select). Disabled when `format === "online"`.
  - When a city is selected and format ≠ online, show a "Worldwide" clear chip (matches Collab Board).
- Extract the combobox once into `src/components/city-combobox.tsx` (shared) so the Collab page can later switch to it; Events imports it now. Same visual spec as the existing Collab `CityCombobox` (h-11 pill, search icon, dropdown list).

## 3. "Near you: Chicago" hint

- Wire `useDefaultCity` + `useApplyDefaultCity({ feedKey: "events", ... })` exactly like Collab Board.
- Below the filter row, render the same two small lines:
  - If active city = IP-inferred default → "Based on your location · see worldwide".
  - If no city and a default exists → "Near you: <Chicago>" (clickable, underline) — matches the user's screenshot.

## 4. Query — filter by venue city

Update `fetchPublicEvents` signature to `(when, format, cityId?)`. When `cityId` is set and format ≠ online, add `.eq("venue_city_id", cityId)`. When format = online, ignore city. Keep existing `format` mapping.

Bump `queryKey` to include `cityId`.

## 5. Tighten Featured strip

The "Live events are coming." featured-events placeholder takes a full row even when empty. Keep `<FeaturedEventsCompact />` as-is (don't refactor that component), but only render the wrapping `<section className="mt-8">` when `when === "upcoming"` AND it actually has events — pass through whatever `FeaturedEventsCompact` already exposes, or wrap it in a conditional that hides when there are zero featured rows. If `FeaturedEventsCompact` has no "isEmpty" signal, leave it but reduce top margin to `mt-6` so it doesn't dominate when empty.

## Technical notes

- Files touched:
  - `src/routes/events.index.tsx` (header + filters + search schema + query).
  - `src/components/city-combobox.tsx` (new — extracted from `collab.index.tsx`).
- DB: no migration; `group_events.venue_city_id` already exists.
- SEO: append `?city=…` to the existing canonical only when a city is active; default canonical stays `https://workshopindie.com/events`.
- No changes to RSVP/group flows.
