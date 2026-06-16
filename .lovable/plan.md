
# Host v1 — what "Spin up your own room" actually grants

The dialog currently asks who can find the room and stops there. Once inside, the only signs of hosting are a "Hosting" badge and the ability to ping mutuals. Guests see no difference. This plan makes hosting visible, scoped, and respected — without giving the host a moderator console they don't need at five seats.

## Principle

A Workshop seats up to five people who chose to be there. The host is the person who opened the door. They get:
- the right to **set the frame** (title, topic, focus message)
- the right to **keep it on track** (ask all to mute, remove someone, lock seats)
- the right to **end the session** for everyone

That's it. No spotlight, no admin console, no "raise hand" queue. The room shell, video grid, chat, and tools panel stay byte-for-byte the same for everyone — host powers are surfaced as a single tucked-away menu plus three small inline affordances.

## A. Make the grant explicit in the dialog

Right now "Open your Workshop" reads like a privacy picker. Add a short, calm "You'll be the host" block under the visibility list, before the footer:

```
You're the host
─────────────────
· Set a focus message everyone sees at the top
· Ask all guests to mute (they can unmute themselves)
· Remove someone if a session goes sideways
· Lock the room — no new seats fill
· End the Workshop for everyone

Anything written, drawn, or pinned stays ephemeral until
someone turns it into a Collab.
```

Five short lines, no icons-per-line — it should read as a small contract, not a feature list. Copy lives in `host-privacy-dialog.tsx` only.

## B. What changes inside the room (host-only)

A new `<HostMenu />` component, mounted next to the existing "Create a Collab" button in the room header. Crown icon, single dropdown, four items. Visible only when `isHost`.

1. **Set focus message** — opens a small dialog with a 140-char text field. Saves to `instant_rooms.focus_message` (new column). Rendered as a hairline strip below the room title for everyone (`<FocusStrip />`). Host can clear it.
2. **Ask all to mute** — fires a Realtime broadcast on the existing room channel. Guests receive a one-tap toast: *"{Host} asked everyone to mute. [Mute me]"* with a 6-second auto-dismiss. Pure social signal — does NOT force-mute via the SFU. Guests stay in control of their own mic; the host just made the ask visible.
3. **Lock the room** — toggles `instant_rooms.locked` (new column). When locked: matchmaker skips it, the join page shows "This Workshop is locked — ask the host for a link", and the live rail tags it `Locked`. Host can unlock anytime.
4. **End Workshop** — confirm dialog. Sets `instant_rooms.status = 'ended'`, broadcasts an `ended` event. Everyone is shown the existing end-of-room screen with one extra line: *"{Host} ended this Workshop."*

A fifth item, **Remove someone**, lives on each guest tile (host-only ellipsis on hover/long-press → "Remove from Workshop"). Confirm dialog. Writes a `instant_room_removals` row (user_id + room_id + until = now + 30 min) and broadcasts a `kick` event for that user_id. RLS on the join function blocks re-entry until `until` expires. Host sees a small toast: *"Removed. They can rejoin in 30 minutes."*

That's the entire host surface. Five capabilities. No tab, no panel, no second sidebar.

## C. What guests see (and don't)

- A small `Hosted by {Name}` line under the room title when there is a host. Avatar + name, links to `/u/$username`. The Crown badge stays on the host's video tile.
- Focus message strip, if set (same component, just read-only).
- Receive-side toasts for "asked to mute" and "ended".
- No host menu, no remove buttons, no lock toggle. The `<HostMenu />` simply does not render.

Leaderless rooms (the matchmaker Lounge with no host) keep today's behavior. The focus strip, lock toggle, and end button are simply unavailable — the room ends when the last person leaves. No code path tries to "promote" a guest to host in v1.

## D. Backend (one migration)

```sql
alter table public.instant_rooms
  add column focus_message text,
  add column locked boolean not null default false,
  add column ended_by_user_id uuid references auth.users(id);

create table public.instant_room_removals (
  room_id uuid not null references public.instant_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  until timestamptz not null,
  removed_by uuid references auth.users(id),
  primary key (room_id, user_id)
);

grant select on public.instant_room_removals to authenticated;
grant all on public.instant_room_removals to service_role;
alter table public.instant_room_removals enable row level security;
create policy "read own removals" on public.instant_room_removals
  for select to authenticated using (auth.uid() = user_id);
```

Server functions (all `requireSupabaseAuth`, all assert `host_user_id = auth.uid()` before writing):
- `setRoomFocusMessage({ roomId, text })`
- `setRoomLocked({ roomId, locked })`
- `removeFromRoom({ roomId, targetUserId })`
- `endRoom({ roomId })`

The matchmaker (`joinLounge`, `joinMediumLounge`) gets two filters: skip rooms where `locked = true`, reject join when the caller has an unexpired `instant_room_removals` row.

## E. Files touched

- `src/components/host-privacy-dialog.tsx` — "You're the host" block + tightened copy on visibility options.
- `src/components/host-menu.tsx` — new. Crown dropdown with four actions + their dialogs.
- `src/components/focus-strip.tsx` — new. Reads `focus_message`; rendered for everyone.
- `src/components/hosted-by-line.tsx` — new. Avatar + display name + profile link.
- `src/components/channel-view.tsx` — add host-only ellipsis on remote tiles → "Remove from Workshop" confirm. Wire `kick` broadcast → leave room for the targeted user. Wire `muteAll` broadcast → toast with "Mute me".
- `src/routes/workshop.$id.tsx` — mount `<FocusStrip />` and `<HostedByLine />`; mount `<HostMenu />` when `isHost`; wire `ended` broadcast.
- `src/lib/instant.functions.ts` — four new server fns + two matchmaker filters.
- One migration as above.

`workshop-tools-panel.tsx`, `waiting-for-others-card.tsx`, `host-first-run-tour.tsx` need a one-line refresh of copy to reference the new powers — no structural change.

## Out of scope for v1

- Spotlight a speaker / pin a video tile
- Raise-hand queue, request-to-speak
- Host promotion / co-host
- Recording, transcripts, captions
- Force-mute via SFU (we ask, we don't force)
- Per-guest permissions matrix
- Persistent bans across rooms (the 30-min cooldown is room-scoped)

These belong in v2 once the v1 contract is real, used, and either trusted or stress-tested.

## Risks and how v1 absorbs them

- **"Ask to mute" feels weak.** It's intentional. Five-seat rooms don't need force-mute, and the social request keeps the host's authority human. We can add a SFU-level mute in v2 if a real session shows it's needed.
- **30-min removal could be abused.** It's per-room only, the removed user keeps platform access everywhere else, and the row is auditable. Acceptable for v1.
- **Leaderless Lounge loses host-only features.** By design — those rooms are the matchmaker's, not a person's. They end when empty.
