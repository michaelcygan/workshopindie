
# Workshop flow audit & unify

One Workshop primitive. Two ways in (drop into a seat, or host your own). One studio (chat + tools). One promotion path (Create a Collab → publish a Work → Gallery), available to whoever takes initiative.

## 1. Route rename — hard cutover `/instant` → `/workshop`

- Rename: `src/routes/instant.tsx` → `workshop.tsx`, `instant.index.tsx` → `workshop.index.tsx`, `instant.$id.tsx` → `workshop.$id.tsx`.
- Update every internal reference: `top-nav`, `mobile-nav`, `instant.functions.ts` callers, `instant-activity-ticker`, `workshop-strip`, `lounge-fork-dropdown`, `welcome-tour`, home CTAs, etc. (full grep at implementation time).
- No redirects, no shims. Old `/instant/*` URLs 404 by design.
- `/workshops/$slug` (plural, slug) stays as-is for persistent workshops. New singular `/workshop/$id` is the ephemeral live-room surface.

## 2. `/workshop` index — clean Drop in vs Host split

Replace the current page with two equally-weighted entry cards at the top:

```text
┌──────────────────────────┐  ┌──────────────────────────┐
│  Drop in                 │  │  Host a Workshop         │
│  Take a seat in a live   │  │  Spin up your own room.  │
│  one. (3 live now)       │  │  You hold host controls. │
│  [medium picker]         │  │  [medium picker]         │
│  [Drop in →]             │  │  [Open my room →]        │
└──────────────────────────┘  └──────────────────────────┘
```

- **Drop in** card: existing matchmaker (`joinLounge` / `joinMediumLounge` + `LoungeForkDropdown`).
- **Host** card: new server fn `hostInstantWorkshop({ medium?, title? })` in `src/lib/instant.functions.ts`. Creates an `instant_rooms` row with `host_user_id = caller`, default title "{Display Name}'s Workshop", cap 5. Returns `{ roomId }`.
- Remove the broken "Host a focused session — open a Workshop on a Collab" pill.
- Shared mic/camera ready row above both cards.
- `WorkshopStrip` (upcoming scheduled context) stays below.

## 3. `/workshop/$id` — make it a real studio

The drop-in room currently only shows `ChannelView`. Bring the studio in:

- Migration: add `instant_rooms.host_user_id uuid null`, `promoted_at timestamptz null`, `source_collab_id uuid null`, `source_workshop_id uuid null`. Add `workshops.source_instant_room_id uuid null`. Hostless lounges keep `host_user_id = null`.
- New tables (mirrors of `workshop_tools` / `workshop_tool_items`, scoped to `instant_rooms`): `instant_tools`, `instant_tool_items`. Full GRANTs + RLS scoped via `is_room_member(room_id, auth.uid())` (function already exists).
- Surface in the room page:
  - `ChannelView` at top (video + chat).
  - Below it, a `RoomStudio` panel with the existing tool components, reused, pointed at `instant_*` tables: `WorkshopToolsPanel` (generalized), `ChatPolls` (already lounge-aware), `room-board`.
- Header: title + "Host" badge if `user.id === room.host_user_id`. Otherwise "Leaderless lounge".

### Ephemerality rule

Everything in `/workshop/$id` is wiped 24h after last presence — extend `src/routes/api/public/workshops.sweep.ts` to also wipe `instant_tool_items`, `instant_whiteboard_assets`, `instant_board_items` for expired rooms. Triggers on writes to any of these reset `instant_rooms.last_activity_at`.

**Exception**: once `promoted_at` is set (step 4), the room is persistent — ephemerality stops, and it now mirrors `/workshops/$slug` retention (rolling 30d inactivity).

## 4. "Create a Collab" — available to anyone with initiative

Visible to:
- The host (if hosted), OR
- **any present participant of a hostless lounge** (any current `instant_presence` row).

Same button in both cases. Placement: top-right of the studio header next to share/exit. Label: **"Create a Collab"** with a `Rocket` icon.

Click → confirm sheet with:
- Title (defaults to room title, editable).
- Short pitch textarea.
- Roster preview = everyone currently present in the room. Caller is the "initiator". For hostless lounges, a short line: "You'll host this Collab. Everyone currently in the lounge will get a one-tap invite to join the persistent Workshop."

Confirm → new server fn `createCollabFromRoom({ roomId, title, pitch })` in `src/lib/collab-workshop.functions.ts` (file already exists, extend):

1. Authorize: caller is the host OR has a current `instant_presence` row for the room.
2. Insert a `workshops` row (persistent, `mode='instant_spawned'`, `host_user_id = caller`, `source_instant_room_id = roomId`). DB trigger fills `slug`.
3. Insert a `collab_posts` row (caller is owner), `live_workshop_id = workshop.id`. The existing `openWorkshopOnCollab` shape is the reference.
4. Copy ephemeral content forward: `instant_tools` → `workshop_tools`, `instant_tool_items` → `workshop_tool_items`, `instant_board_items` → `workshop_board_assets`, `instant_messages` → `workshop_messages` (last 24h, optional — gives the persistent room a starting backlog).
5. **Stamp the source room** `promoted_at = now()` and `source_workshop_id = workshop.id`. This stops the 24h sweep from clearing it and signals the UI to switch into "Promoted — opt in" mode.
6. **Opt-in invites for the lounge crowd** (key piece): for every user with current `instant_presence` in the source room (excluding the initiator), insert a row into a new `workshop_join_invites` table (workshop_id, invitee_user_id, source_room_id, status='pending', created_at). Also fire a `workshop_invite_from_room` notification so they see it immediately.
7. The initiator is auto-added as host + confirmed participant. **No one else is auto-added** — that's the "opt-in" guarantee.
8. Return `{ workshopSlug, collabSlug }`. Client navigates to `/workshops/$slug` and toasts a link to the Collab.

### Source-room UX after promotion

When `promoted_at IS NOT NULL` on the room you're sitting in:
- Banner replaces the "Create a Collab" button: **"This Workshop became a Collab → [Open persistent room]"**.
- If you have a pending `workshop_join_invites` row: a one-tap **"Join the persistent Workshop"** button. Accepting inserts a `workshop_participants` row (`confirmed`) and navigates you there.
- The 24h sweep still clears the old ephemeral room normally — the persistent Workshop is the canonical artifact going forward.

This is the "save as" you described: the lounge keeps existing, ephemeral, until presence drops to zero; meanwhile a persistent fork lives at `/workshops/$slug` with everyone invited but no one forced in.

## 5. Workshop → Collab → Work → Gallery breadcrumb

Small `WorkshopProgressBar` component at the top of `/workshops/$slug`:

```text
Workshop  ──▶  Collab  ──▶  Work  ──▶  Gallery
   ●           ●            ○           ○
```

Lit dots show what's been reached; the next dot is the current-stage CTA inline ("Publish the Work" → "View in Gallery"). Reuses existing `collab-publish` and `works.new` flows — no new logic, just visibility.

## 6. Nav copy

- Top-nav and mobile-nav: existing "Workshop" entry now points to `/workshop`.
- Home page CTAs that pointed at `/instant` now point at `/workshop`.

## Technical notes

- Migration includes: new `instant_rooms` columns, new `workshops.source_instant_room_id`, new `instant_tools` + `instant_tool_items` tables (with GRANTs + RLS), new `workshop_join_invites` table (RLS: invitee can SELECT/UPDATE own row; initiator/host can SELECT all rows for their workshop).
- New server fns in `src/lib/instant.functions.ts`: `hostInstantWorkshop`.
- New / extended fns in `src/lib/collab-workshop.functions.ts`: `createCollabFromRoom`, `acceptWorkshopJoinInvite`.
- Sweep extension lives in the existing `workshops.sweep.ts`.
- No changes to chat, polls, rolling-30d inactivity semantics for persistent workshops, auth, or RLS on the `workshops` table itself.

## Out of scope

- Recorder / screen-share polish.
- Persistent Board (already on followup list).
- Notification template overhaul beyond the new `workshop_invite_from_room` kind.
- Changes to `/workshops/new` form — still works for fully scheduled planned sessions; Host on `/workshop` is the recommended path going forward.
