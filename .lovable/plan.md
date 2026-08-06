# Group Event Directory

Turn each Group's Events surface into a durable, public, filterable directory at `/g/{slug}/events` — built entirely on the existing Event primitive. No new tables, no new taxonomy, no migration.

## What I found in the current code (conflicts worth naming first)

1. **The Group Events tab ignores multi-group links.** `GroupEventsTab` in `src/routes/g.$slug.index.tsx` queries `group_events` filtered by `group_id = group.id` only. The Event admin flow writes "Also show in" links into `event_groups`, and the server function `listGroupEvents` already reads through `event_groups` correctly. So the promise "the event will appear on each selected group's Events tab" is currently **false on the Group page**. This is the highest-priority correctness fix.
2. **Event kind labels are wrong.** The local `KIND_LABELS` map in the Group tab lists `workshop`, `meetup`, `show`, `reading`, `class` — none of which exist. The real supported kinds are `open_mic`, `listening_party`, `networking`, `screening`, `workshop_irl`, `online`, `other`, `lineup`. Labels need centralizing so the admin composer and the directory can never diverge.
3. **`creative_category` already exists** on `group_events` and the admin flow already writes it — it is simply not selected by the Group tab query. No migration needed.
4. **Hybrid is handled by accident.** The current format filter excludes by opposite value, which happens to include hybrid, but there is no explicit hybrid option and the copy says "format" (which collides with creative medium language elsewhere).
5. **Archived events leak into the Past list.** The Group tab query omits the `archived_at is null` guard that every other discovery surface applies.

## Waves

### Wave 1 — Connect the existing taxonomy
- Add `creative_category` (and the missing `archived_at` guard) to the Group events query; extend the `EventLite` type with `creative_category: MediumGroupKey | null`, typed from `@/lib/medium-groups`.
- Null-safe throughout: legacy events without a category simply never match a category filter.
- Confirm recurrence collapsing preserves the field (it already passes whole rows through) and that the series materializer carries `creative_category` onto new occurrences; fix it there if it does not.

### Wave 2 — Shared event vocabulary
- New `src/lib/events/kinds.ts`: the canonical kind list + human labels (Open mic, Listening party, Networking, Screening, Workshop, Online, Show / Lineup, Other), derived from the database enum.
- Point both the admin composer (`src/routes/admin.events.tsx`) and the directory at it. Delete the local divergent map.
- Same file exports attendance labels (Any attendance / In person / Online / Hybrid) so a future member-facing composer reuses one definition.

### Wave 3 — The directory component
- Extract the events body into `src/components/group/group-event-directory.tsx`, keeping the existing card design, section structure (Pinned & recurring / Upcoming / collapsed Past) and Workshop styling.
- Filter row becomes: Category → Event type → Attendance → Search, all as the existing rounded dropdown controls, wrapping cleanly on mobile with no clipped menus.
- Categories and kinds are derived from the Group's own event set (same approach as today's `availableKinds`), so empty options never appear.
- Attendance semantics: **In person** includes `in_person` + `hybrid`; **Online** includes `online` + `hybrid`; **Hybrid** available as its own option. Hybrid is never excluded from both.
- Search stays local and cheap across title, tagline, venue name, and external organizer.
- Filters apply consistently to Pinned/Recurring, Upcoming, and Past. Empty state keeps "No events match your filters — Clear".

### Wave 4 — Events connected to the Group (correctness)
- Rewrite the directory's query to resolve `event_groups` links for the Group first, then read those event rows — matching the existing `listGroupEvents` semantics — so "Also show in" actually works.
- Deduplicate by event id so an event that is both primary and explicitly linked appears once; recurring series still collapse to one card.

### Wave 5 — Dedicated public URL
- New route `src/routes/g.$slug.events.tsx` rendering the Group hero, tab bar and the directory, so Group chrome is not duplicated.
- The Events tab navigates to `/g/{slug}/events`; other tabs return to `/g/{slug}?t=…` naturally.
- Legacy `/g/{slug}?t=events` redirects cleanly (single replace navigation, no loop), preserving `?j=` seed tokens.
- Fully public: no auth or membership gate anywhere on the page.

### Wave 6 — Shareable filter URLs
- Filter state moves into validated search params: `?category=`, `?kind=`, `?format=`, `?q=`, using canonical stored values.
- Direct navigation initializes the UI from the URL; filter changes use replace navigation so browsing does not spam history; Clear returns to the bare `/g/{slug}/events`.

### Wave 7 — Directory SEO
- Route-specific `head()` generated from Group data:
  - City Group: `Independent Events in Chicago | Workshop` + a description naming open mics, screenings, workshops, shows and meetups.
  - Other Groups: `Events in {Group Name} | Workshop`.
- Canonical always `https://workshopindie.com/g/{slug}/events`, including when filters are active. Simple `CollectionPage` + `ItemList` JSON-LD listing upcoming events; individual Event pages remain the canonical Event documents.

### Wave 8 — Card density (light touch)
- Keep the card design. Add one restrained metadata line (event type, and category when present) beside the existing time · venue line. No badge pile-up, no layout change, no new imagery.

## Technical notes
- No database migration. `creative_category`, `event_groups`, `published_at`/`archived_at` all already exist.
- Event detail URLs, Event creation permissions (admin-only), and the external-event architecture (canonical Workshop page first, outbound link on the Event page) are unchanged.
- Realtime stays on the single `useEventsRealtime(groupId)` channel.

## Acceptance checks I'll run
Logged-out load of `/g/chicago/events`; tab navigation and legacy `?t=events`; category / kind / attendance / search filters individually and combined; hybrid inclusion; filter state from a cold URL; Clear; no duplicate cards for multi-group or recurring events; upcoming/past boundaries; events with null category; empty Group state; mobile layout; and the head/canonical output on both the directory and the generic Group page.
