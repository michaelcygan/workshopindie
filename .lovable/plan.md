# Lounge simplification pass

Goal: reshape the live room around live networking without rebuilding it. Keep every real-time / media / presence system, keep Chat + Collabs + Work as the three content tabs, and strip UI that implies Lounge is a production workspace.

Scope is intentionally narrow — presentation and copy only, no schema, no realtime rewrites, no changes outside `/lounge/*`.

## 1. Header (`src/routes/lounge.$id.tsx`)

- **Demote "Create a Collab"**: replace the primary `<Button>` with a small ghost link ("New Collab from here") tucked next to the `End` button. Keeps the flow, stops it dominating a networking room. Sheet component (`CreateCollabSheet`) stays as-is.
- **Rename Skip control**: pass a `label="Next Lounge"` prop through `HopButton` (or update the button in place) so the header CTA and keyboard shortcut hint read "Next Lounge" instead of "Skip". Tooltip: "Find another live Lounge". Only one Hop button in the header — remove the duplicate `HopButton` render inside `ChannelView` (line ~693 or 938, whichever is the redundant sidebar copy).
- **Remove `<LicenseChip />`** from the live-count row. Lounge conversations are not licensed content.

## 2. Tab bar (`src/components/channel-view.tsx`, `StageTabs`)

- Remove the **Tools** popover trigger and its `<Popover>` block entirely. Tabs collapse to: `Chat`, `Work`, `Collabs`.
- Remove `activeTool` state plumbing tied to the tab bar (leave the underlying `WorkshopToolsPanel` intact; it just no longer mounts as a "tab").
- Remove `composerLeading` `ComposerToolButton` from the chat composer — no in-chat tool inserter.

## 3. Call controls (screen share + PiP as first-class)

The existing `MediaPanel` renders mic/cam/leave. Screen share and PiP currently only live inside the Tools panel.

- In `ChannelView`, mount **Screen Share** and **Pop-out** as buttons in the primary media control row (next to mic/cam). Reuse `WorkshopScreenSharePanel`'s start/stop hook and `PopOutButton` from `workshop-pip.tsx` — no new logic, just surface them.
- Tooltip copy:
  - Screen share: "Share your screen" / active: "Stop sharing"
  - PiP: "Keep Lounge visible" (Picture-in-Picture)
- Keep permission-denied / already-sharing states handled by the existing panel; surface toast errors on failure.

## 4. Tools panel — retire from Lounge

- Delete the `toolsSlot` prop wiring from `LiveRoomPage` → `ChannelView`. The `WorkshopToolsPanel` file itself stays (Workshops still use it via `workshops.$slug.tools.*`).
- Delete `ComposerToolButton` usage in Lounge only.
- Legacy `drive` / `player` rows in existing rooms remain reachable via the Workshop route if they were promoted; nothing is deleted from the DB.

## 5. Empty / alone state (`WaitingForOthersCard`)

Light copy pass only — confirm room is loaded, list conversation starters ("Say hi", "What are you working on lately?", "Who are you hoping to meet?"), and offer "Find another Lounge" (Hop) + link back to `/lounge`. No new component.

## 6. CreateCollabSheet cleanup

The sheet still exists (reachable from the demoted header link) but the room-level rights radio group is misleading in a networking context:
- Keep the sheet functional (it creates a Collab, which does have a license).
- Change section label from "Rights" → "Collab license" so it is clearly about the new Collab, not the Lounge.

## 7. Files touched

- `src/routes/lounge.$id.tsx` — demote CTA, drop `LicenseChip`, drop `toolsSlot` + `composerLeading`, rename sheet label.
- `src/components/channel-view.tsx` — remove Tools tab from `StageTabs`, drop `composerLeading` slot, mount ScreenShare + PiP buttons in media controls, remove duplicate `HopButton`.
- `src/components/hop-button.tsx` — label "Next Lounge", tooltip update.
- `src/components/waiting-for-others-card.tsx` — copy pass.
- (No changes to) `workshop-tools-panel.tsx`, `workshop-screen-share-panel.tsx`, `workshop-pip.tsx`, Collabs/Work panels, server functions, schema.

## 8. Explicit non-goals

- No rename of Lounge, no changes to matchmaker, presence, media provider, chat table, moderation, or auth.
- No changes to `/collab`, `/workshops`, `/g/*`, `/me`, or any other route.
- No DB migration. Legacy `instant_tools` rows are ignored by the new UI but preserved.
- Chat, Collabs, and Work tab internals unchanged — they already pull participants' open Collabs & published Work.

## Acceptance check after build

1. `/lounge/$id` header shows: title, live count, Next Lounge, small "New Collab" link, End (namer only). No `LicenseChip`, no big Rocket CTA.
2. Tab bar shows exactly Chat / Work / Collabs. No Tools dropdown, no `+ Tool` button in composer.
3. Media control row shows: mic, cam, screen share, PiP, leave.
4. Only one Skip/Hop control exists, labelled "Next Lounge".
5. Screen share start/stop + PiP open/close still work; permission-denied still toasts.
6. Nothing outside `src/routes/lounge.*` and `src/components/channel-view.tsx` / `hop-button.tsx` / `waiting-for-others-card.tsx` is modified.
