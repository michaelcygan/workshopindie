
# In-Workshop Collaboration Suite

Four features, one shared design language: lightweight overlays/popovers that float over the live room so audio + video + chat never disconnect. Built on existing `ChannelView` + `MediaPanel` + `FullscreenRoom`, no schema changes for #1, #2, #4 — only the whiteboard adds a table + bucket.

---

## 1. Profile peek popover

**Trigger:** Click any name/avatar in the participants list (`MediaPanel` `SpeakerRow`, `FullscreenRoom` tile labels, chat message author chip).

**Component:** new `ProfilePeek` using shadcn `HoverCard` on desktop / `Drawer` on mobile.

**Contents:**
- Avatar, display name, `@username`, headline, city
- Bio (clamped 3 lines)
- Stats row: followers · following · works
- **Follow button** (reuses existing `FollowButton`)
- Horizontal strip of up to 6 most recent published works (cover thumbnails, click → opens **Work peek** modal — see #2)
- "View full profile →" link to `/u/$username` (opens new tab so the room stays alive)

**Data:** single `getRoomMemberPeek(userId)` server fn (createServerFn) returning `{ profile, recentWorks: [...] }`. Cached client-side per userId for the session.

---

## 2. Gallery view with tabbed works

**Toggle:** new "Gallery" pill button in `MediaPanel` header (icon: `LayoutGrid`). Clicking flips the chat panel into gallery mode; clicking again returns to chat.

**Layout (per user pick — gallery-emphasis split):**

```text
┌─────────────────────────────────────────┬──────────┐
│                                         │ Video    │
│           GALLERY (dominant)            │ rail     │
│   [Tabs: Everyone | @alex | @sam | …]   │ (compact │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐           │  audio + │
│   │work│ │work│ │work│ │work│           │  video   │
│   └────┘ └────┘ └────┘ └────┘           │  tiles)  │
│                                         ├──────────┤
│                                         │ Chat     │
│                                         │ (slim,   │
│                                         │  collap- │
│                                         │  sible)  │
└─────────────────────────────────────────┴──────────┘
```

- Gallery takes ~70% width; right rail ~30%, video on top, chat below.
- On mobile: gallery full-width, video as floating PiP bubble (draggable), chat as bottom-sheet toggle.
- Tabs: "Everyone" (merged + sorted by recency) plus one tab per participant (avatar + first name).
- Works fade/scale-in with `motion` stagger on tab change.

**Work peek modal:** clicking a work card opens a centered `Dialog` over the gallery (NOT navigation). Shows cover, title, creator chip (clickable → Profile peek), excerpt, like/comment counts, license, "Open full work →" external link. Esc or backdrop closes — room never unmounts.

**Data:** `getRoomGallery(userIds[])` server fn → `{ worksByUser: Record<userId, Work[]> }`. Refetched when participants change (debounced).

**Fullscreen mode:** also gets the gallery toggle in the top bar; in fullscreen, gallery overlays as a center column with video tiles shrinking into a top strip.

---

## 3. Ephemeral collaborative whiteboard

**Library:** `tldraw` (`bun add tldraw`) — full freehand, shapes, text, images, sticky notes out of the box. ~250kb gz, code-split into a dynamic import so it only loads when the board opens.

**Toggle:** "Whiteboard" pill in `MediaPanel` (icon: `PenLine`). Opens as a third view mode (chat | gallery | whiteboard) so the right rail stays as video+chat.

**Sync model:** tldraw `store.listen()` → Supabase Realtime broadcast on `whiteboard:${roomId}` channel, debounced 100ms. Each client applies inbound deltas via `store.mergeRemoteChanges`. No DB writes for shapes — pure realtime, dies with the channel.

**Image uploads & pastes:**
- Drag-drop / paste → upload to new public bucket `instant-whiteboard`, key `{roomId}/{uuid}.{ext}`, max 5MB.
- "Paste URL" tldraw asset handler accepts http(s) URLs directly (no upload).
- "From my works" picker (small button in tldraw toolbar) → opens a sheet listing the user's works, click inserts as image asset.

**Cleanup (the "ephemeral" promise):**
- New table `instant_whiteboard_assets (id, room_id, storage_path, created_at)`.
- New `purge_room_whiteboard(_room_id)` server fn (admin client): deletes storage objects + rows.
- Called from: (a) `join_lounge` ghost-archive sweep — purge when room flips to `archived`; (b) `handleExit` when the leaving user is the last presence.
- Belt + suspenders: nightly cron-style cleanup of any assets older than 24h with no active room.

---

## 4. In-room follow

Already covered by Profile peek's `FollowButton` — no separate UI needed. Add one ambient touch:
- When a follow happens inside the room, broadcast a tiny ephemeral toast to both users only ("You followed @alex" / "@sam followed you ✨") via the existing media channel. Decays in 4s, doesn't pollute chat.

---

## World-class polish (small things that matter)

1. **Speaking ring on profile peek avatar** — if the peek target is currently speaking, the avatar pulses with the existing primary ring.
2. **Presence-aware tabs** — gallery tabs for users currently speaking get a subtle dot; tabs for users who left fade to 60% opacity for 10s before disappearing (no jarring layout shifts).
3. **"Show me yours" nudge** — empty state in a user's gallery tab shows "@sam hasn't published anything yet — ask them about their work" with a one-click chat prefill.
4. **Whiteboard cursors with names** — tldraw supports presence cursors; show each participant's name + accent color following their pointer.
5. **Reaction confetti on follow** — when a follow lands, a tiny burst of motion particles emits from the followed user's tile (existing framer-motion, no new dep).
6. **Keyboard shortcuts in fullscreen:** `G` toggle gallery, `W` toggle whiteboard, `C` toggle chat, `M` mute, `V` camera, `Esc` minimize. Footer hint on hover.
7. **"Save board snapshot"** before the workshop wraps — when the 1s alone-trigger fires and the "Workshop wrapped" prompt appears, add a third button: "Download whiteboard PNG" so the work isn't lost. Uses `tldraw`'s built-in export.
8. **Recently viewed works** — clicking work peeks adds them to a small "Just looked at" tray in the gallery footer for quick re-open during convo.

---

## Technical notes

- **Files added:**
  - `src/components/profile-peek.tsx`
  - `src/components/work-peek.tsx`
  - `src/components/room-gallery.tsx`
  - `src/components/room-whiteboard.tsx` (lazy)
  - `src/lib/room-views.functions.ts` (`getRoomMemberPeek`, `getRoomGallery`, `purgeRoomWhiteboard`)
- **Files edited:**
  - `src/components/channel-view.tsx` — view-mode state (`"chat" | "gallery" | "whiteboard"`), passes through to right rail; wraps name/avatar mentions with `ProfilePeek`; Save-board option in the wrapped-workshop dialog.
  - `src/components/media-panel.tsx` — view toggle pills; `SpeakerRow` becomes `ProfilePeek` trigger; new `RightRail` shell that renders chat/gallery/whiteboard.
- **DB migration:** `instant_whiteboard_assets` table (RLS: insert=room presence, select=room presence, delete=admin/owner) + bucket `instant-whiteboard` (public read, authed write).
- **No changes to** `use-media-room`, `joinLounge`, `instant_rooms`, `instant_messages`, `instant_presence`.

---

## Out of scope (callouts)

- Persisting whiteboards across sessions (explicitly ephemeral per request).
- Server-side recording of audio/video.
- Notifying the followed user via email — uses existing follow side-effects only.
- Reordering or pinning gallery works (could be a v2 nice-to-have).

Once you approve, I'll start with the profile peek + gallery (no new infra), then ship the whiteboard + storage migration as the second pass so you can review each piece live.
