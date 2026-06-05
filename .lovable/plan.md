# Workshop flow audit & unify — shipped

One Workshop primitive. Two ways in (Drop in or Host). One promotion path (Create a Collab → Work → Gallery), available to anyone with initiative.

## Shipped this pass

- **Hard rename `/instant` → `/workshop`** across all routes and links. Old links 404 by design.
- **`/workshop` index** now has two equally-weighted cards: **Drop in** (matchmaker) and **Host** (new `hostInstantWorkshop` server fn — gives caller a "You're hosting" badge in the live room).
- **`/workshop/$id` live room** shows:
  - Host badge if you're the host; "Leaderless lounge" pill otherwise.
  - **"Create a Collab"** button (top-right) visible to host OR anyone currently in the room.
  - Confirmation sheet: title + pitch. Forks the live room into a persistent Workshop + paired Collab post.
  - "Promoted" banner once a Collab has been created from the room, with a one-tap **Join** for invited participants.
- **Migration**: `instant_rooms.host_user_id / promoted_at / source_workshop_id`, `workshops.source_instant_room_id`, new `workshop_join_invites` table with RLS.
- **New server fns**: `hostInstantWorkshop`, `createCollabFromRoom`, `acceptWorkshopJoinInvite`, `declineWorkshopJoinInvite`.
- **WorkshopProgressBar** at the top of `/workshops/$slug` shows Workshop → Collab → Work → Gallery, lighting up dots as the Workshop advances.
- All `/instant` references in nav, tour, profile pages, home, and channel-view rewritten to `/workshop`.

## Behavior recap

- A live room (`/workshop/$id`) is ephemeral. Drop-ins are leaderless lounges. Hosted rooms get the host badge but otherwise look the same.
- Anyone in the room can Create a Collab. Doing so forks the room into a persistent `workshops` row + linked Collab post, and sends opt-in invites to everyone else currently in the room. No one is auto-added.
- The original live room stays ephemeral (cleared 24h after presence drops), but is now marked `promoted_at` and surfaces a banner linking to the persistent fork.
- The persistent Workshop follows the existing rolling-30-day inactivity archive rules.

## Out of scope for this pass

- `instant_tools` / `instant_tool_items` tables — Phase 2 if hosts want persistent tools in ephemeral rooms.
- Notification copy / templates for the new `workshop_invite_from_room` kind beyond the raw row.
- Recorder / screen-share polish, persistent Board.
- Changes to `/workshops/new` form — still works for fully scheduled planned sessions.
