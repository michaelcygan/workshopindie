# Group section bar — honest counts and a Today signal

Every section in a Group's bar should answer "is there anything in here?" before you tap it. Right now only Collabs, Gallery, Members, and Groups carry a number.

## Answer on Links

Links is half-wired today. The route still renders the Links section and `?t=links` deep links still resolve, but the section was dropped from the bar in the recent navigation pass, so nothing in the UI points at it. It is a read-only projection of URLs shared in Today (last 24 hours), so it is usually empty in quiet Groups.

Proposed: bring Links back into the bar, but only when it has something — same rule as Resources.

## What changes

**Counts added to the bar**

- Events — number of upcoming events connected to this Group (via the group-event links, series collapsed, same window the Events section uses). Hidden when zero, tab still shown.
- Resources — number of published resources (already computed for visibility; just displayed).
- Blog — number of posts on the Group's blog surface (already computed).
- Links — number of links shared in Today in the last 24 hours; the section appears only when this is above zero.
- Today — no static count; it gets the live indicator below.

Counts render in the existing quiet style (small muted number after the label) and are omitted at zero, so the bar never advertises emptiness.

**Today: new-message indicator**

- A small dot on the Today label when messages have arrived since you last looked at that Group's Today, with a count up to 9+.
- "Last looked" is stored per Group in your browser and updated whenever Today is the visible section (including on arrival, since Today is the default). Switching to Collabs and back does not re-trigger it.
- Signed-out visitors don't get the indicator — it's a return-visit signal, not a teaser.
- New messages arriving while Today is open bump the marker rather than lighting the dot.

## Technical notes

- `src/components/group/group-tab-bar.tsx`: extend the `counts` prop to `{ collab, work, members, events, posts, resources, links }`, add a `showLinks` flag mirroring `showResources`, and add a `todayUnread: number` prop rendering a dot + count on the Today item. Existing count rendering (hide at zero) is reused.
- `src/routes/g.$slug.index.tsx`: add two cheap count queries — upcoming events (`event_groups` → `group_events` ids, `applyDiscoverable` + `applyCurrentWindow`, series collapsed, 5-minute stale time) and Today link count (reuse the `["group", id, "today-links"]` query key so the Links section and the badge share one fetch). Blog and resource counts are already in scope. Pass `showLinks={linkCount > 0}` and keep the existing `t=links` fallback to Today when empty.
- New `src/components/group/use-today-unread.ts`: reads/writes `ws.groupTodaySeen.<groupId>` in `localStorage`, counts `group_today_posts` for the Group with `created_at` greater than the stored timestamp and `expires_at` in the future (head-count query), subscribes to the existing realtime channel pattern for that table, and resets to zero while the Today section is active.
- No schema, RLS, or write-path changes; all reads use existing policies.
