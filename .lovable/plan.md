## Make venue name & address tappable on event pages

Right now the "In person" block in `EventLocationCard` just renders text. Since venues are standardized (we store `venue_name`, `venue_address`, and often `lat/lng` via `resolveVenueAndCity`), we can make them actionable.

### Recommendation

Do **both**, contextually — one primary tap action + a secondary copy affordance, so mobile users get the map they expect and desktop users get something equally useful:

1. **Primary tap (the venue block itself):** open the location in the OS's default map app.
   - Use a universal `https://www.google.com/maps/search/?api=1&query=…` URL. iOS/Android both handle this: iOS routes google.com/maps links to Apple Maps if Google Maps isn't installed (via the system handler) — and even when it opens in-browser, Google Maps' mobile page offers "Open in app." This avoids the `maps:` / `geo:` scheme fragmentation and works on desktop too (opens Google Maps in a new tab).
   - Prefer `query=lat,lng(Venue Name)` when we have coordinates (more accurate); fall back to the URL-encoded address string.
2. **Secondary "Copy" button** next to it (small ghost icon button, same pattern already used for the online Join link in this component) — one tap copies the full address, toasts "Copied". Useful on desktop and for users who want to paste into Uber/Lyft/Waze.

### Interaction details

- Wrap the venue name + address in a single `<a target="_blank" rel="noreferrer">` so the whole block is a tap target (better mobile ergonomics than a tiny link).
- Add a subtle hover underline on the name, `ExternalLink` icon after the name (matching the existing "Join link" styling for consistency).
- Copy button: reuse the existing `Copy` icon + `toast.success("Address copied")` pattern already in the file.
- Logged-out state is unchanged (still shows the "RSVP to see the full address" lock chip — no link, no copy).

### Files touched

- `src/components/event-location-card.tsx` — only file that needs to change. Wrap the in-person name/address in an anchor to the map URL, add a `Copy` ghost button beside it. No schema, no server changes.

### Out of scope

- No changes to the map embed (`VenueMap`) — it already links out to OpenStreetMap.
- No native app deep-linking (`maps:` / `geo:`) — universal Google Maps URL covers both platforms without UA sniffing.
