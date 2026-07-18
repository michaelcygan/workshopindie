## Goal

Turn the admin "Create event" dialog (also reused when admins hit "+ Create → Event") into a fast, 2027-feeling flow with a photo picker instead of a raw URL field and a live venue search that suggests real places by name or address — no paid API keys.

## Scope

- File: `src/routes/admin.events.tsx` — the `CreateEventDialog` component from the screenshot.
- New small component: `src/components/event/venue-autocomplete.tsx`.
- Reuse: `uploadToBucket("covers", ...)` from `src/lib/storage.ts` and the existing `useAuth()` user id.

Everything else (server function, schema, group form) stays untouched.

## Venue search — free, no key

Use **OpenStreetMap Nominatim** (`https://nominatim.openstreetmap.org/search`) directly from the browser:
- Free, no signup, no key, CORS-enabled.
- Query params: `q=<user text>`, `format=json`, `addressdetails=1`, `limit=6`, `namedetails=1`.
- Send a compliant `User-Agent`/`Referer` (browser adds Referer automatically; we set an `Accept-Language` header).
- Debounce input at 300 ms, cancel prior requests with `AbortController`.
- Bias results toward the user's current group city when we have one (append `viewbox` + `bounded=0` using the group city coords if present; otherwise just global search — Nominatim will still surface named venues like "Monsignor Murphy's").
- Show a dropdown of results as `Name · short address`. Selecting a result fills both `venue_name` (from `namedetails.name` or the first address token) and `venue_address` (formatted from `address`).
- Manual typing still works — the dropdown is a suggestion layer, not a hard gate.

Attribution: add a tiny "Powered by OpenStreetMap" line under the dropdown (Nominatim usage policy).

## Photo upload

Replace the "Cover image URL" text input with a drag-and-drop / click-to-upload tile:
- Accepts JPG/PNG/WebP up to 8 MB.
- On drop, immediately preview locally, then upload via `uploadToBucket("covers", user.id, file)` and store the returned public URL in `form.cover_url`.
- Show progress + a "Replace" and "Remove" action on the preview.
- Keep an "Advanced: paste URL" collapsible for the rare case someone already has a hosted image.

## Dialog polish (2027 pass, presentation only)

- Reorganize into 3 grouped sections with subtle dividers: **Basics** (title, tagline, kind/format, cover photo), **When & where** (date range, venue autocomplete or online URL), **Publishing** (group targeting, source, recurrence, capacity, feature/pin, promo months).
- Larger rounded inputs (`rounded-xl`), consistent 12 px vertical rhythm, sticky footer with "Cancel / Create event" so the primary CTA is always visible in the scrollable dialog.
- Inline validation hints (red text under the field) instead of only the toast.
- Auto-fill `ends_at` to `starts_at + 2h` when the user picks a start and leaves end empty.

## Technical notes

- No new dependencies. Nominatim fetch is a plain `fetch()` in the component.
- No changes to `createEvent` server fn or DB — `cover_url` still stores a URL string; venue fields are still plain text.
- `covers` bucket already exists and is wired through `uploadToBucket`.
- Debounce + abort implemented with a small `useEffect` — no new hooks lib.

## Out of scope

- Group-side event creation (there isn't a separate group form today; admin dialog is the single path). If you also want this on a future non-admin form, we'll port the same `VenueAutocomplete` component.
- Map preview of the selected venue (can add later if you want a mini static map).
