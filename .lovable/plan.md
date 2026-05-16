# Unify Workshop room template

Yes — a Workshop should be a standard "live room" backed by `ChannelView`. Scheduled Workshops layer scheduling extras (applications, check-in, finalize/credits) on top of the same room, so any future room-level improvement (auto-end, admin dismiss, whiteboard, gallery, video, presence) ships to both flows automatically.

## Architecture

```text
ChannelView (single source of truth for any live room)
  ├── Instant Workshop  → backing instant_rooms row (kind='lounge')
  └── Scheduled Workshop → backing instant_rooms row (kind='workshop')
       wrapped by scheduling shell:
         Hero · HostStatusBar · CheckIn · Roles/Apply · Applications · Finalize
```

A `workshops` row holds the scheduling metadata (title, time, roles, applications, host, status). When the host opens the live room, we lazily create/find a paired `instant_rooms` row of `kind='workshop'` and use its UUID as `roomId` for `ChannelView`. Confirmed participants (and host) gate entry.

## Changes

**DB migration**
- Allow `kind='workshop'` in `instant_rooms.kind` check constraint.
- Add nullable `instant_rooms.workshop_id uuid references workshops(id) on delete cascade` with unique index (one room per workshop).
- RLS: read/write on `instant_*` rows tied to a workshop allowed for the host plus confirmed/checked-in/completed participants.
- Server function `ensureWorkshopRoom({ workshopId })`: host-or-confirmed-participant gate; inserts the paired room if missing, returns its id.

**Frontend**
- `src/routes/workshops.$slug.tsx`: delete the bespoke `Room` (custom chat + participants list) and the duplicated message/presence wiring. Replace with `<ChannelView roomId={pairedRoomId} title={ws.title} initialMode="voice" pinned={<WorkshopPinnedHeader …/>} />` once `pairedRoomId` is fetched.
- Keep all scheduling pieces (`HostStatusBar`, `CheckInPanel`, `RolesAndApply`, `HostApplications`, `FinalizePanel`, `ShippedBanner`) — they live above/below the unified room.
- `WorkshopToolsPanel` moves into the `pinned` slot (or below the room) so the unified template stays clean.
- Gate the room mount: only render `ChannelView` when `isLive || isHost` AND the user is host/confirmed; otherwise show the existing "opens for confirmed participants" notice.

**ChannelView (no behavior changes, light tweaks only)**
- Already accepts `roomId`, `title`, `pinned`, `initialMode` → works as-is.
- The 5-min/alone auto-end already gated by multi-party history; scheduled rooms behave identically (admins can still dismiss).
- Whiteboard purge already keys off `roomId` — works for either kind.

## Migration of existing data

Existing `workshop_messages` / `workshop_participants` stay (used for credits + finalize). Chat history from old scheduled workshops won't auto-port into the unified room — acceptable since the live chat is ephemeral. Credits/finalize still read from `workshop_participants`, which is unchanged.

## Out of scope
- No changes to applications/check-in/finalize/credits logic.
- No changes to Instant Workshop UX.
- `workshop_messages` table left in place; can be deprecated later.

## Files touched
- new `supabase/migrations/<ts>_workshop_unified_room.sql`
- new `src/lib/workshop-room.functions.ts` (`ensureWorkshopRoom`)
- edit `src/routes/workshops.$slug.tsx` (drop bespoke Room, mount ChannelView)
