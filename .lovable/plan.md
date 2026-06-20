## Two tweaks to the unified Stage

### 1. Tools tab → dropdown picker on the main tab bar

Tools stays on the Stage tab bar alongside Chat / Work / Collabs, but instead of opening into a panel that renders its own secondary tab strip ("Pop-out × … + Tool"), it behaves like a dropdown:

- Click "Tools" → a popover opens directly beneath the tab listing the available tools (Pop-out, Screen Share, Drive, Board, List, Player, Recording) plus any already-enabled tools at the top with a checkmark.
- Pick a tool → the Stage body switches to that tool's panel (Pop-out config, Drive, Board, etc.). The tab pill now shows "Tools · Pop-out" (active tool name) so you know what's loaded.
- The secondary header row inside `WorkshopToolsPanel` (the dark "Pop-out × … + Tool" strip) is suppressed when the panel is rendered through the Stage; the dropdown becomes the only switcher.
- Reopening the dropdown lets you swap tools without leaving the Stage. Selecting "None" / clicking the active tool again returns the Stage to Chat.

Result: one switcher (Stage tab bar), no nested tabs.

### 2. Claim Host pill uses RadioTower (radar) icon

`src/components/claim-host-pill.tsx` currently uses the `Crown` icon for every state (Claim Host, Confirming…, unclaimable). Swap all four `Crown` usages for `RadioTower` (already the project's host motif — used in `HostedByLine`, `HostMenu`, and the workshop lobby's "Host a session" CTA).

The "Host · settings" pill in the Stage dock (when the viewer is already host) also switches to `RadioTower` for consistency.

## Files touched

- `src/components/channel-view.tsx`
  - Replace the Tools button in `StageTabs` with a popover trigger. Add a `ToolsMenu` popover that lists available tools and calls a callback to open the chosen one.
  - Track active tool id in component state; pass it through to the Tools render path so the panel renders that specific tool directly.
  - Active label shows on the tab (e.g. "Tools · Pop-out") and the chevron rotates when the menu is open.
  - Swap `Sparkles` for `RadioTower` in the Dock's "Host · settings" pill.
- `src/components/workshop-tools-panel.tsx`
  - Accept an optional `activeTool` prop and a `chromeless` prop. When `chromeless` is true, suppress the in-panel header (the "Pop-out × … + Tool" row) and render only the selected tool body. When `activeTool` is provided, force `currentType` to that value.
- `src/components/claim-host-pill.tsx`
  - Replace all `Crown` imports/usages with `RadioTower`.

No backend, routing, or data-shape changes.

## Technical notes

- Popover: use the existing shadcn `Popover` primitive (`@/components/ui/popover`) so styling matches. Trigger is the Tools tab button itself.
- Tool list source: reuse the `PRESETS` + `TOOL_REALTIME` / `TOOL_OBJECTS` arrays already exported from `workshop-tools-panel.tsx` — export a small `LIVE_TOOLS` constant so `channel-view` can render the picker without importing the whole panel.
- Active tool state persists per-room in `sessionStorage` under `room-tool:${roomId}`.
- When no tool is selected and the user clicks the Tools tab without picking, default to the currently-enabled / category-suggested tool (the same fallback `WorkshopToolsPanel` uses today).
