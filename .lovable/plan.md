## Goal
Fix the "Hosted by" line on the event page and support listing an event across multiple groups.

## 1. "Hosted by" shows the real organizer

The schema already stores `external_organizer` (text) and `external_url` (text) on `group_events` — captured in the admin event creation flow. The event page currently hardcodes `Hosted by {group.name}`.

Update `src/routes/g.$slug.e.$eventSlug.tsx` to:
- If `ev.external_organizer` is set, render `Hosted by {external_organizer}` as a link to `ev.external_url` (opens in new tab, `rel="noopener noreferrer"`, external-link icon). Falls back to plain text if no URL.
- Otherwise keep current behavior (`Hosted by {group.name}` linking to the group).
- Include `external_organizer` and `external_url` in the `EventRow` type + loader select (verify `getEventBySlug` returns them; add if missing).

The group avatar next to "Hosted by" is replaced by a small globe/link icon when the host is external, so users don't confuse the group for the organizer.

## 2. "Listed in" — multi-group cross-posting

New join table so one event can appear in multiple groups without duplicating rows:

```
public.group_event_groups
  event_id uuid  -> group_events(id) on delete cascade
  group_id uuid  -> groups(id) on delete cascade
  added_by uuid, added_at timestamptz default now()
  PRIMARY KEY (event_id, group_id)
```

- Backfill: insert `(id, group_id)` for every existing `group_events` row so the primary `group_id` is always represented.
- Keep the existing `group_events.group_id` as the canonical/primary host group (owns the slug, RLS, notifications). The new table only powers discovery + display.
- RLS: `SELECT` open to `anon`/`authenticated` (event visibility already gates the event itself); `INSERT`/`DELETE` restricted to the event creator and group admins of the target group. GRANTs added in the same migration.
- Update group listings (`listFeaturedEvents`, group Today/Events tabs) to `UNION` events reachable via `group_event_groups` so cross-posted events surface in each group.

## 3. Admin — pick additional groups when creating/editing

In `src/routes/admin.events.tsx`:
- Add a "Also list in" multi-select below the primary group picker (searchable list of groups the admin can post to).
- On save, upsert rows into `group_event_groups` for the chosen groups; on unselect, delete the row.
- Same control on the edit path.

## 4. Event page — "Listed in" strip

On `src/routes/g.$slug.e.$eventSlug.tsx`, under the "Hosted by" row (or just under the tagline), render a small chip row:

`Listed in: [Chicago] [Comedy Chicago] [Improv Nerds]`

- Fetched via a new lightweight fn `listEventGroups({ event_id })` returning `{ id, slug, name, avatar_url }[]`.
- Each chip links to `/g/$slug`.
- Hidden when the event is only in one group.

## Technical notes
- Migration steps (single file): create table, GRANTs, enable RLS, policies, backfill from `group_events`.
- No changes to notifications, RSVP, or series logic — those stay keyed off the canonical `group_id`.
- Type regen happens after the migration approves; code edits in step 1/3/4 come after.
