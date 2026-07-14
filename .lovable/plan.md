# Events MVP — Minimal Extension

Confirmed: **one canonical event object**, tagged to a group. That's already how the schema works today — `group_events` is just an event row with a required `group_id`. We keep it that way. Every event has exactly one group tag (its "home" group). We don't need a separate global events object.

If later we want an event to belong to multiple groups, we add a small join table — but not for day 1.

## 1. Migration (one file, additive)

Add columns to `group_events`:
- `source` text check `('workshop','external')` default `'workshop'`
- `external_url` text — the "View event" destination
- `external_organizer` text — display name for external hosts
- `is_recurring` boolean default false
- `recurrence_label` text — free-text admin caption ("Every Tuesday", "First Friday")
- `pinned_at` timestamptz — non-null = pinned to top of the group's Events tab

`format` (`in_person | online`) + `online_url` already exist and cover the Zoom case — admin pastes the link, we render it. Admin-only writes already enforced by existing RLS.

No RRULE engine, no occurrence table, no multi-group join, no timezone recompute.

## 2. Admin form (`src/routes/admin.events.tsx`)

Four new controls on the existing form:
- **Source**: Workshop / External. External → require `external_url`, show `external_organizer`, hide RSVP-only fields.
- **Format**: In person / Online (already there). Online → single "Zoom / meeting URL" field bound to `online_url`, hide venue.
- **Recurring**: checkbox → shows `recurrence_label` text input. No date math.
- **Pin to top**: checkbox → sets/clears `pinned_at`.

URL validation server-side: must be `http(s)://`, reject `javascript:` / `data:`.

The event's group tag is the existing group picker — unchanged.

## 3. Group Events tab (`src/routes/g.$slug.tsx` → `GroupEventsTab`)

Three sections, each hidden when empty:
1. **Pinned & recurring** — `pinned_at IS NOT NULL OR is_recurring = true`, ordered `pinned_at DESC NULLS LAST, starts_at ASC`. Card shows `recurrence_label` (or "Pinned") + next date.
2. **Upcoming** — one-time, non-recurring, `starts_at >= now()`, chronological.
3. **Past** — leave existing behavior.

Header:
- Title becomes `Events in {group.name}` + one-line subheading.
- Remove the inline `+ Create event (admin)` link.
- Admin-only `+ Add event` on the right (deep-links to `/admin/events?group={id}`).
- Hide the tab-row `+ Create` on the events tab for non-admins.

Empty state: `The calendar is quiet for now.` — no member CTA.

## 4. Event card (`src/components/event-card.tsx`)

Small conditional tweaks driven by the same object:
- `source = 'external'` → primary action `View event` opens `external_url` in a new tab (`rel="noopener noreferrer"` + external icon), small "External event" label, no RSVP block.
- `source = 'workshop'` → unchanged RSVP flow.
- `format = 'online'` → "Online" label (with platform hint if URL matches Zoom/Meet), no empty venue line.
- `is_recurring` → show `recurrence_label` above title.
- `pinned_at` → subtle pin indicator.

Main Events page and homepage just pick up the new events automatically — same object, same queries.

## Not doing on day 1

- No RRULE engine or per-occurrence exceptions (recurring = a label + one canonical row the admin re-dates or clones).
- No multi-group join.
- No RSVP-gated Zoom links for workshop online events.
- No external verification workflow.
- No changes to homepage relevance rules.

## Files

- `supabase/migrations/<new>.sql` — additive columns only
- `src/routes/admin.events.tsx` (+ shared form) — 4 new fields
- `src/routes/g.$slug.tsx` — `GroupEventsTab` rewrite (~80 lines)
- `src/components/event-card.tsx` — source/recurrence branches
- `src/lib/group-events.functions.ts` — extend list query, add `listPinnedAndRecurringForGroup`

## Verify

- Workshop one-time → Upcoming.
- Pinned "Every Tuesday" recurring → top of Pinned & recurring.
- External event with URL → "View event" opens the URL.
- Online workshop event with Zoom URL → attendees see the join link.

Approve and I'll ship the migration first, then the code in one pass.
