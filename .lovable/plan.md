# Pass 11 — Events & Groups as the on-ramp

## Reframe

You'll host the first real events (WIP nights, listening parties, networking) under the **Groups** primitive. Non-users will land on event pages from invites/social and need to feel pulled into the platform — not just "save the date." Audit covers:

- `/g/$slug/e/$eventSlug` (event page) — 496 lines
- `/g/$slug` (group page) — 882 lines
- `/groups` (groups index) — 352 lines
- The event posting flow (currently admin-only via `/admin/events`)

---

## Findings

### 🔴 Gap 1 — No public `/events` page exists
Every event lives at `/g/{group}/e/{event}`. There's no top-level "what's happening on Workshop" surface. Bad for:
- **Discovery** (a new user clicking your invite has nowhere to "browse other events")
- **SEO** (no crawlable index page → events compete for rank one by one)
- **Founder ops** (no single place to verify your scheduled lineup)

### 🟡 Gap 2 — RSVP doesn't join the host group
`rsvp` server fn only writes `group_event_rsvps`. A user who signs up to attend your listening party is **not** added to the group, so they never see the next event, never see the works/collabs the scene produces. This is the single biggest stickiness leak in the event funnel.

### 🟡 Gap 3 — Event page has no "what this scene produces" cross-sell
The event page shows attendee works/collabs (great) but never shows the **host group's** own works/collabs. A non-user thinking "this event looks cool" has no second click into "look at the work this scene is making." This is the real utility wedge you described.

### 🟡 Gap 4 — `EventRsvpAuthSheet` undersells
Copy says "RSVP to join" + "Takes 20 seconds." Doesn't tell the user they're joining the **group** too, doesn't preview what they'll unlock (apply to collabs, see WIP, etc.). Conversion lift available.

### 🟢 Gap 5 — Group page default-tab logic is over-clever
`g.$slug.tsx` defaults to "events" but then `useEffect` immediately swaps to whichever tab has most content. For your launch where **events are the on-ramp**, Events should just always be the default. Simpler logic, predictable URL.

### 🟢 Gap 6 — Event posting flow is admin-only and lives in `/admin/events`
For v1 with you as solo founder this is correct — but the in-group entry point (`Request to host (coming soon)`) is dead copy. We should either link admins to the admin dialog from the group page, or quietly hide the row for non-admins. (Tiny cleanup.)

### 🟢 Gap 7 — Event page has 4 tabs (About / Lineup / Activity / Wall)
The Wall is for going-only chat. The Activity tab is showcases + attendee work. These could merge into a single "Activity" tab with the wall above attendee work — fewer tabs, more density. **Defer** unless you want it now; it's a real touch on UX.

---

## Proposed changes (ranked by leverage)

### 1. Auto-join host group on RSVP `[HIGH]`
`src/lib/group-events.functions.ts` → in `rsvp`, when status is `going`/`maybe`, also `INSERT INTO group_members (group_id, user_id)` (ignoring duplicates). Fully silent on the user side. **This is the single highest-stickiness change in the audit.**

### 2. Public `/events` index route `[HIGH]`
Create `src/routes/events.index.tsx`:
- Server-loaded list of upcoming public events (next 60 days), grouped by week
- Hero copy: "What's happening on Workshop"
- SEO meta + `ItemList` JSON-LD
- Empty-state CTA: "Browse groups"
- Add `/events` to `sitemap[.]xml.ts` static paths
- Add a `Events` link to top-nav under "More"

### 3. "From this scene" rail on the event page `[HIGH]`
Below the RSVP block on `g.$slug.e.$eventSlug.tsx`, add a compact rail with:
- 3 latest published works from the host group (`group_works` → `works`)
- 1 open collab from the host group (`group_collabs` → `collab_posts`)
- Header: "What this scene is making"
- For logged-out viewers, this is the **deep utility preview** that pulls them in beyond just "save the date."

Implement as a new lightweight component `<EventHostGroupRail groupId groupSlug />` so it's reusable. Two cheap parallel queries via the publishable client.

### 4. Stronger RSVP auth sheet copy `[MED]`
`EventRsvpAuthSheet` → change title to "RSVP and join {groupName}" and add a 3-bullet preview ("See what the scene is making", "Apply to open collabs", "Get notified about the next one"). Pass `groupName` down from `EventRsvpBlock`. Conversion polish, no logic change.

### 5. Simplify group page default tab `[LOW]`
`g.$slug.tsx` → drop the `useEffect` + `defaultTab` swap. Always default to `"events"`. URL becomes predictable; you also stop a one-frame tab flicker.

### 6. Clean dead "Request to host" copy `[LOW]`
In `GroupEventsTab`, only render the host-affordance row when `isAdmin`. Drops a confusing greyed-out line for the 99% who aren't admins.

---

## Deferred (don't ship this pass)

- **4 → 3 tab merge on event page** (wall + activity). Real UX call; want your nod.
- **Member-host event creation flow**. You said in-person is launch+1; same for member-hosted online events. Stay admin-only for v1.
- **Calendar feed / ICS** improvements. Already wired per-event.
- **Event series RSVP reminders** — exists via existing notifications, not in scope.

---

## Files this pass would touch

**Edits**
- `src/lib/group-events.functions.ts` — auto-join group on RSVP
- `src/routes/g.$slug.e.$eventSlug.tsx` — mount `<EventHostGroupRail />`, pass groupName
- `src/components/event-rsvp-block.tsx` — pipe groupName through
- `src/components/event-rsvp-auth-sheet.tsx` — copy + bullets
- `src/routes/g.$slug.tsx` — drop default-tab swap; hide dead "Request to host" copy
- `src/routes/sitemap[.]xml.ts` — add `/events`
- `src/components/top-nav.tsx` — Events link under "More"

**New**
- `src/routes/events.index.tsx` — public events index
- `src/components/event-host-group-rail.tsx` — cross-sell rail

---

## Estimated impact

| Change | Stickiness | Discovery | Effort |
|---|---|---|---|
| Auto-join group on RSVP | 🟢🟢🟢 | — | XS |
| Public `/events` index | 🟢 | 🟢🟢🟢 | M |
| "From this scene" rail | 🟢🟢 | 🟢 | S |
| Auth-sheet copy upgrade | 🟢 | — | XS |
| Group default-tab cleanup | — | — | XS |
| Hide dead host copy | — | — | XS |

Total: ~1 build turn. Switch to build mode and I'll ship 1–6.
