## Goal

Let admins attach one event to one OR many groups when creating it, so a Chicago open mic can appear in "Chicago" and "Chicago · Folk" at the same time without duplicating the record.

## Approach

Keep the event as a single canonical row. Introduce a lightweight join table so extra groups can be tagged in addition to the event's primary `group_id` (which stays required — it owns the event slug, URL, and ownership).

### 1. Migration — `event_groups` join table

```
event_groups
  event_id  uuid  → group_events(id)  on delete cascade
  group_id  uuid  → groups(id)        on delete cascade
  primary key (event_id, group_id)
  created_at timestamptz default now()
```

- Grants: `authenticated` select, `service_role` all.
- RLS: select allowed to anyone who can see the underlying event; insert/update/delete restricted to admins (mirrors `group_events` admin policy).
- Backfill: `INSERT INTO event_groups (event_id, group_id) SELECT id, group_id FROM group_events` so every existing event has itself listed. From now on, the primary `group_id` is always mirrored into `event_groups` too.

### 2. Server function — `createEvent` in `src/lib/group-events-admin.functions.ts`

- Accept a new optional `group_ids: string[]` alongside existing `group_id`.
- Treat `group_id` as the primary/canonical group (used for slug and route).
- After insert, upsert rows into `event_groups` for every id in `group_ids ∪ {group_id}` (dedup). No-op if only the primary is selected.
- Same treatment for the update path (if/when admin edit lands) — out of scope for this pass unless trivial.

### 3. Admin form — `src/routes/admin.events.tsx`

Replace the current single `Group` `<Select>` with:

- **Primary group** — the existing `<Select>` (required). Determines URL/slug/ownership.
- **Also show in** — a multi-select chip picker underneath, listing all other groups from `adminListGroups`. Selecting one adds a removable pill. Empty by default.
- Submit sends `group_id` (primary) plus `group_ids` (extras, primary excluded to keep the payload clean; server re-adds it).

Small, self-contained component inside `admin.events.tsx` — no new files needed. Uses existing shadcn primitives (Command / Popover) to stay consistent with the rest of admin UI.

### 4. Read paths — where multi-group takes effect

- **Group Events tab (`g.$slug.tsx`)** — swap the current `group_events.group_id = :group.id` filter for `event_id IN (SELECT event_id FROM event_groups WHERE group_id = :group.id)`. This is the whole point: an event tagged to N groups shows up under each.
- **Main events page + homepage** — no change; they already read from `group_events` directly and each event still has exactly one row. Dedup is automatic.
- **Admin table** — no change (still one row per event, primary group shown). Optionally show a `+N` chip if extras exist — nice-to-have, will include if it's a 3-line addition.

### 5. Not doing on day 1

- No UI for members to see "also posted in" list on the event detail page. Can add later as a small footer chip row.
- No changing the event's primary group after creation.
- No per-group visibility overrides (e.g. hide from one but keep in others).

## Files touched

- New migration (join table + backfill + RLS + grants)
- `src/lib/group-events-admin.functions.ts` — extend `createEvent` payload + writes
- `src/lib/group-events.functions.ts` — group-scoped list query switches to join-table filter
- `src/routes/admin.events.tsx` — add multi-select "Also show in"
- `src/routes/g.$slug.tsx` — pick up the new query shape (types only if any)
