
# Simplify Lounge for v1 — updated

Goal: make Lounges feel like drop-in networking. One flavor only. No private/Collab Lounges. Group Lounges stay, but they're only visible to group members. The tool set is trimmed to async/single-player primitives, and the in-room host role is gone.

## What stays

- **Chat** — unchanged.
- **Collab / Work pinning inside a room** — participants can still pin a collab post or feature a work while inside a Lounge (`instant_room_pins`, `instant_room_work_pins`). The connection is inside-out (from Lounge → surface), not outside-in.
- **Tool picker (v1 set):** Screen Share, Pop-out (PiP), Drive, Player.
- **Public open Lounges** — `visibility: "open"`, the default drop-in fork. Matchmaker, `LoungeForkDropdown`, `HopButton` all keep working.
- **Group Lounges** — `joinGroupLounge` stays, gated on `group_members` membership (unchanged). Visible on the Group page, home rails, and the Lounge index — but ONLY to signed-in users who belong to that group. Non-members never see them.
- **Presence, hop, fork dropdown, `WaitingForOthersCard`, `FocusStrip`**.

## What goes

### From the tool picker (both open Lounges and paired Workshop rooms)
- **Board**, **List**, **Recording** removed from the picker and `ActiveToolBody` routing. Legacy enabled rows keep rendering via the `presetFor()` fallback so nothing crashes for existing rooms.

### In-room host role (everywhere)
- Delete Lounge usages of `BecomeHostNudge`, `HostFirstRunTour`, `HostedByLine`, `HostMenu`, `ClaimHostPill`, `host-privacy-dialog`, `host-room-events`, `startHostClaim` and the `Crown` icon in `lounge.$id.tsx`.
- In `WorkshopToolsPanel`: `canEnable = true` for anyone in the room. Creators can still remove tools they added; no other host-only affordances.
- Scheduled-workshop "host" (owner of the `workshops` row) stays for edit permissions on the workshop page. Only the *in-room* host role and its UI disappear.

### Private / Collab-scoped Lounges (fully retired)
- **Remove `joinCollabLounge`** from `src/lib/instant.functions.ts` (server fn + any `visibility: "invite"` code path it depends on).
- **Delete `src/components/open-lounge-button.tsx`** and remove all 5 usages in `src/routes/collab.$slug.tsx` (lines 23, 406, 488, 505, 516, 616). No "Open the Lounge" button on any Collab page.
- Any lingering `visibility: "invite"` code branches (e.g. the `notifyLoungeSpawn` early-return, the create-room fork) are simplified to the single `"open"` path. Keep the `visibility` column in the DB so existing rows don't break — new rooms just always insert `"open"` (or `"group"` for group rooms if that value already exists; otherwise `"open"` gated by `group_id`).
- `instant_rooms.collab_id` column stays in place (schema untouched) but new rooms never populate it. Existing invite rooms keep rendering if someone still has a link, but no new ones can be created.

### Lounge index / home rails visibility rules
- `listActiveInstantRooms` (and any home/Lounge-page rail) filters:
  - `kind = 'lounge'` and `status = 'active'`
  - AND (`group_id IS NULL` — public open Lounge) OR (`group_id` matches a group the current user belongs to).
  - Signed-out viewers see only `group_id IS NULL` public Lounges.
- On the Group page, the Group's Lounge card is only rendered when the viewer is a member (already the pattern — verify and tighten if needed).

## What we intentionally do NOT change

- **Database schema.** `visibility`, `collab_id`, `group_id`, `host_user_id`, `instant_board_items`, `workshop_tools` — all stay. Cleanup migrations can come later once we're sure nothing's referencing them.
- **Paired Workshop rooms** (`kind = 'workshop_live'`) — same tool trim + host-UI removal as instant Lounges, but the scheduling/ownership model on the `workshops` row is untouched.
- **Screen Share / PiP / Drive / Player / chat / pins / presence / hop / fork** internals — untouched.
- **`OpenLoungeButton` component's Collab-invite-acceptance logic is deleted**, not repurposed. Accepted collaborators still get their normal Collab access; they just don't get a private Lounge.

## Files touched

- `src/components/workshop-tools-panel.tsx` — trim `PRESETS`/`TOOL_REALTIME`/`TOOL_OBJECTS` to `screen_share`, `pip`, `drive`, `player`; drop host gating (`canEnable = true`); remove Board/List/Recording cases from `ActiveToolBody`.
- `src/routes/lounge.$id.tsx` — remove host-UI imports and JSX (`HostFirstRunTour`, `HostedByLine`, `HostMenu`, `BecomeHostNudge`, `HostRoomEvents`, `startHostClaim`, `Crown`).
- `src/routes/collab.$slug.tsx` — remove `OpenLoungeButton` import + 5 render sites.
- `src/lib/instant.functions.ts` — delete `joinCollabLounge`; collapse `visibility === "invite"` branches in `createInstantRoom` / `notifyLoungeSpawn` / listing fns; tighten `listActiveInstantRooms` to hide group Lounges from non-members.
- Delete (after verifying no other importers): `src/components/open-lounge-button.tsx`, `src/components/become-host-nudge.tsx`, `src/components/host-first-run-tour.tsx`, `src/components/hosted-by-line.tsx`, `src/components/host-menu.tsx`, `src/components/host-privacy-dialog.tsx`, `src/components/host-room-events.tsx`, `src/components/claim-host-pill.tsx`, `src/components/room-board.tsx`. If any is still imported elsewhere (admin, workshop scheduling), leave the file and only remove the Lounge usage.
- `src/routes/workshops.$slug.tools.$tool.tsx` / `workshops.$slug.tools.tsx` — remove Board/List/Recording from the picker UI.

## Verification

1. Fresh Lounge (public open) shows only Screen Share, Pop-out, Drive, Player; no host CTA, no "Hosted by" line.
2. `/collab/$slug` (any Collab post) shows no "Open the Lounge" button anywhere on the page.
3. Signed-out viewer at `/lounge` sees only public open Lounges; group Lounges are hidden.
4. Signed-in member of Chicago group sees the Chicago Lounge on `/lounge`, home rails, and `/g/chicago`. Non-members don't see it in any of those surfaces.
5. Any participant in a room can enable/disable a tool; creator can still remove tools they added.
6. Existing rooms with Board/List/Recording or a `host_user_id` still render (legacy fallback) — the UI just no longer surfaces those affordances for new rooms.
7. Typecheck + build clean; no orphan imports of the removed components or `joinCollabLounge`.

