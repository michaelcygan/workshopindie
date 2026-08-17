# Streamline group event filters to match the Groups page

Right now the events area inside a Group uses a one-off filter row: small text dropdown menus ("All categories", "All event types", "Any attendance") floated right, plus a magnifier that expands into a tiny search box. The /groups page uses the shared sticky filter header primitive (pill search + pill selects + city picker + clear). This makes the two surfaces look and behave differently.

## What changes

The group events filter row is rebuilt on the same shared filter header used by /groups, so it looks and behaves identically:

- Sticky bar that pins under the header with the blurred background and hairline border.
- Full-width pill search on the left ("Search events…"), debounced live filtering.
- Pill controls on the right, in a horizontally scrollable row on mobile:
  - Medium (all mediums present in this group's events, with counts)
  - Event type (all kinds present in this group's events)
  - Attendance (In person / Online / Hybrid / Any)
- A "Clear" button appears only when at least one filter is active.
- The magnifier-expands-into-input pattern and the old dropdown-menu pills are removed.

Filter state stays URL-backed exactly as today, so shareable filtered links keep working, and both the embedded tab on the group page and the standalone /g/{slug}/events page get the same bar.

Sections below the bar (Pinned & recurring, Upcoming, Past) and the "See all events" link are unchanged.

## Technical notes

- Edit `src/components/group/group-event-directory.tsx`: replace the local `FilterMenu` block and `searchOpen` state with `FilterHeader`, `FilterSearch`, `FilterControls`, `FilterSelect`, and `FilterClear` from `@/components/filter-header`, matching the composition in `src/components/groups/groups-control-row.tsx`.
- Options remain derived from the group's own event set (`availableCategories`, `availableKinds`) so empty filters are never offered; add counts to the medium options for parity with Groups.
- No city picker here — a group's events are already scoped to one place; city stays out of the row.
- Use `inset` on the header for the embedded variant so it spans the group shell's padded container, and verify the sticky offset does not collide with the group tab bar or the Leaflet mini-map z-index fix already applied on /events.
- No data, query, or route changes.
