
# Rebrand: "Workshop" live room → "Lounge"

"Workshop" stays as the platform brand. The live-room concept becomes **Lounge** — an ambient, drop-in artist hangout. Scheduled workshops collapse into Events. Collab-from-Lounge is a personal pop-up. Each Group gets its own Lounge. Each active Collab gets a private Lounge for confirmed members only.

---

## 1. Vocabulary & URLs

| Old | New |
|---|---|
| /workshop (tab) | **/lounge** |
| /workshop/$id | **/lounge/$id** |
| /workshops, /workshops/new, /workshops/$slug, /workshops/lobby/new, /workshops/$slug/archive, /workshops/$slug/tools | **Deleted** (folded into /events) |
| "Hop to next Workshop" button | **"Skip"** |
| "Enter Workshop" | **"Join Lounge"** |
| "Instant Workshop: Film" titles | **"Lounge: Film"** |
| Nav "Workshop" item | **"Lounge"** |
| Create menu "Workshop" entry | **Removed** |

DB table names (`workshops`, `workshop_*`, `instant_rooms`, `instant_*`) stay — UI/route-only rename.

---

## 2. Scheduled Workshops → Events

- Delete `/workshops/new` and `/workshops/lobby/new` (lobby flow goes away entirely — Lounges aren't planned, they're joined).
- Delete `/workshops`, `/workshops/$slug`, `/workshops/$slug/tools(*)`, `/workshops/$slug/archive`.
- One-shot migration server fn: copy `workshops` rows into `group_events` (host's primary group → else archived silently). 301 `/workshops/$slug` → corresponding `/g/$slug/e/$eventSlug`. `/workshops` index → 301 `/events`.
- Drop landing-page "Workshop" feature card; reorder becomes **Lounge · Collab · Event**. Lounge card copy: ambient drop-in (no "plan one" CTA — only "Join now").
- Remove `api/public/workshops.sweep.ts` after migration.
- "Create" global menu loses Workshop entry. Lounges are never created by users.

---

## 3. Lounge model (3 kinds)

All three kinds live in the existing `instant_rooms` table, distinguished by which FK is set:

### a) Open lounges (existing)
Matchmaker / medium-chip drop-in. Unchanged behavior, renamed copy.

### b) Group lounges
- New: `instant_rooms.group_id uuid references groups(id)` + index.
- Group page gets a **"Join Lounge"** button.
  - If a non-full group-scoped room is live → join it.
  - If full → spin up a sibling group room (same `group_id`).
  - If none live → create on click.
- Surfaces in `/lounge` under "Group lounges live now" grouped by group.
- Non-members CAN join (ambient discovery). Inside the room, a one-tap "Join group" inline CTA shows for non-members.

### c) Collab lounges — PRIVATE
- `instant_rooms.collab_id uuid references collab_posts(id)` (rename of/parallel to the current `workshop_id` link used by paired rooms).
- "Open Lounge" button on a collab page calls `ensureCollabLounge` server fn.
- **Access policy**: only confirmed collab members may enter. RLS + server-side gate on join:
  - owner of the collab, OR
  - `collab_guest_applications.status = 'accepted'`, OR
  - `collab_invites.status = 'accepted'` for that user.
- Collab lounges are NOT listed in `/lounge` public tabs (private surface only).
- If the lounge is empty for >N minutes it auto-closes; reopens on next "Open Lounge" click.

---

## 4. /lounge tab

- Top: "Skip in" CTA + medium chips (matchmaker, unchanged).
- Section: **Group lounges live now** (group_id IS NOT NULL, grouped by group).
- Section: **Open lounges** (no group_id / no collab_id).
- (Collab lounges do not appear here — private only.)

---

## 5. Collab-from-Lounge — pop-up, no navigation

- Delete `src/lib/collab-workshop.functions.ts` formalize path and the HostMenu "fork room into Collab" action.
- The "Create Collab" button inside a Lounge opens a **modal/dialog** (Radix `Dialog`) hosting a trimmed `/collab/new` form. On submit:
  - Collab is created owned by the clicker only.
  - Toast: "Created. Pin it to this Lounge?" → one-tap pins to `instant_room_work_pins` (or a parallel `instant_room_collab_pins`).
  - The active Lounge session is never unmounted — no route change, mic/cam stay live.
- Form fields kept minimal: title, category, short pitch, optional cover. Anything else (roles, deadlines, etc.) is editable later from the collab page.

---

## 6. Lounge interior — keep UI as-is, trim only dead weight

The room shell stays mostly identical. **Keep**: Polls, Tasks (part of List), Demos, Docs, Drive, Board, Player, Screen share, Pop-out, mic/cam/leave + **Skip** (renamed Hop).

**Delete** (unused / flagged off for v1):
- Recorder personas — remove `recorder_personas` UI surfaces, hooks, and the related routes/components. (Keep tables for now; just remove UI.)
- Any orphaned components from the old "formalize as Collab" flow.
- The "lobby" concept and its components (`createLobby`, `lobby.functions.ts`, `LobbyPerson`) — superseded by group lounges + pop-up collab creation.

---

## 7. SEO / metadata / copy

- `public/llms.txt`: update "Workshop (live room)" → "Lounge" definitions.
- Sitemap: remove `/workshops/*`; add `/lounge` (rooms themselves stay unindexed).
- `__root.tsx` Organization JSON-LD: mention Lounges/Collabs/Events/Groups.
- `/w/$token` link landing: copy → "Join the Lounge".

---

## 8. Files touched

**New routes:**
- `src/routes/lounge.tsx` (layout)
- `src/routes/lounge.index.tsx` (port of `workshop.index.tsx`)
- `src/routes/lounge.$id.tsx` (port of `workshop.$id.tsx`)

**Deleted:**
- `src/routes/workshops.tsx`, `workshops.index.tsx`, `workshops.new.tsx`, `workshops.lobby.new.tsx`, `workshops.$slug.tsx`, `workshops.$slug.archive.tsx`, `workshops.$slug.tools.tsx`, `workshops.$slug.tools.$tool.tsx`
- `src/routes/workshop.tsx`, `workshop.index.tsx`, `workshop.$id.tsx` (after lounge.* port)
- `src/lib/collab-workshop.functions.ts`
- `src/lib/workshop-archive.functions.ts` (if Events covers it)
- `src/lib/lobby.functions.ts` and lobby UI
- `src/lib/recorder-personas.functions.ts` UI surfaces (tables stay)
- `src/routes/api/public/workshops.sweep.ts`

**Redirect shims (kept for one release):**
- `/workshop` → `/lounge`, `/workshop/$id` → `/lounge/$id`
- `/workshops`, `/workshops/$slug` → `/events` (or mapped event)

**Renamed (code only):**
- `enter-workshop-button.tsx` → `enter-lounge-button.tsx`
- `host-first-run-tour.tsx`, `host-room-events.tsx`: copy → "Lounge", "Skip"
- `instant.ts formatRoomTitle`: "Workshop:" → "Lounge:"
- `workshop-room.functions.ts` → `lounge-room.functions.ts` (`ensureCollabLounge`, new `ensureGroupLounge`)
- `hop-button.tsx`: label "Skip", route to `/lounge/$id`

**Edited (copy + links):**
- `top-nav.tsx` (tab label, Create menu pruned)
- `index.tsx` landing (Lounge · Collab · Event)
- `g.$slug.tsx` + `group-tab-bar.tsx` (add "Join Lounge" button)
- `collab.$slug.tsx` (add "Open Lounge" for confirmed members only)
- `signup-gate-modal`, `w.$token.tsx`, `llms.txt`, sitemap, `__root.tsx` head
- Admin pages mentioning Workshops-as-event

**DB migration (one):**
```sql
ALTER TABLE instant_rooms ADD COLUMN group_id uuid REFERENCES groups(id);
ALTER TABLE instant_rooms ADD COLUMN collab_id uuid REFERENCES collab_posts(id);
CREATE INDEX ON instant_rooms (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX ON instant_rooms (collab_id) WHERE collab_id IS NOT NULL;
-- RLS: collab lounges visible/joinable only to owner + accepted applicants + accepted invitees
```
Plus the one-shot `workshops` → `group_events` backfill in a separate migration.

---

## 9. Risks / confirms before build

- **Workshop tools (Docs/Board/Drive) attached to scheduled workshops**: reparent to host's group during backfill, or drop if no group. **Confirm rule before running migration.**
- **External `/workshops/$slug` links**: handled by 301 shim for one release. OK?
- **`workshop_*` tables** stay in schema as cold archive; full drop is post-launch.

---

## 10. Out of scope

- Renaming DB tables.
- Building a new lounge UI from scratch — port + trim.
- Mesh bandwidth governor, age gate, RLS architecture — stay as built.

Build order on approval: (1) DB migration for `group_id` + `collab_id` + RLS, (2) port routes & rename components, (3) delete old files + add 301 shims, (4) wire Group/Collab "Join/Open Lounge" buttons + pop-up collab creator, (5) copy/SEO sweep, (6) verify build.
