## Mental model

Two windows, one room:

- **Stage** (left, big): the active surface. Holds video tiles up top and one of: Chat, Tools, Work, Collabs underneath. This is where attention goes.
- **Dock** (right, narrow): the room's identity + your controls. Mic, camera, leave, who's here, presence works rail. No view-switching duty.

Today those roles are blurred — the Chat/Tools/Work/Collabs tabs live inside the right Dock (a `MediaPanel` segmented control), so changing what's on Stage means reaching into the sidebar. That's the "broken flow" feeling. The fix is to move the tabs onto the Stage and let the Dock get quieter.

## What changes

### 1. Stage gets a persistent tab bar (the only place to switch views)

A single segmented control pinned to the top of the Stage panel, just under the video row:

```text
┌─ Stage ─────────────────────────────────────────────┐
│  [video tiles row]                          ⊟ ⧉ ⛶  │
│  ── Chat · Tools · Work · Collabs ─────────────────│
│  (active surface fills the rest)                    │
└─────────────────────────────────────────────────────┘
```

- Tabs are always visible and never hide — swapping Tools ↔ Chat is one click, no sidebar trip.
- The existing top-right icon cluster (focus/PiP/fullscreen) stays put as the Stage's window chrome.
- "Tools" tab shows a small badge dot when a tool is active (board has items, screen share live, player queued).
- "Collabs" badge counts open invitations.
- Tab state persists per-room in `sessionStorage` so reopening the room lands on the last surface.

### 2. Dock is repurposed as the "Workshop" status card

Same width (260px), same position, but it stops being a switcher. From top to bottom:

```text
┌─ Workshop ──── 1/5 ┐
│ ● Title            │   ← room title + capacity
│ [Mic] [Camera]     │   ← personal controls
│ [New]    [Exit]    │   ← session controls
│                    │
│ Claim Host  / Host │   ← persistent (when applicable)
│ Hop to another     │   ← HopButton
│                    │
│ HERE NOW · n       │
│  • avatar list     │   ← presence
│                    │
│ YOUR RECENT WORK   │   ← presence works rail
└────────────────────┘
```

What moves out of the Dock:
- The Chat / Tools / Work / Collabs segmented tabs (now on Stage).

What moves in / stays:
- Claim Host pill becomes a permanent slot here (not buried in chat empty-state), and flips to "Host" → host settings once owned.
- HopButton moves up next to New/Exit so all session actions live together.

### 3. "Focus video" toggle behavior

The Columns2 icon already hides the Dock and gives the Stage full width — keep that. With tabs on the Stage, focusing video still lets the user switch surfaces; the Dock just disappears, which is exactly what "focus" should mean.

### 4. Empty-state alignment

`EmptyLaunchpad` (Quiet in Workshop) keeps the suggestion chips but drops the "Claim Host & set a direction" chip — that action now lives permanently in the Dock, so it doesn't need to be re-surfaced inside Chat.

## Files touched

- `src/components/channel-view.tsx`
  - Render a `<StageTabs>` segmented control above the view-mode body (chat/tools/gallery/collabs swap inside).
  - Persist `viewMode` to `sessionStorage` keyed by `roomId`.
  - Pass `viewMode`/`onViewModeChange` out of `MediaPanel`.
  - Remove the Claim Host chip from `EmptyLaunchpad`'s chip row; mount `ClaimHostPill` in the Dock column instead.
- `src/components/media-panel.tsx`
  - Drop the internal Chat/Tools/Work/Collabs segmented control + its props from the dock layout. Keep mic/camera/new/exit/here-now/title. (Props become optional/no-op for callers that still pass them.)
- `src/components/claim-host-pill.tsx`
  - Add a "Host" success state (Crown + label) that links to host settings when the viewer is the current host.

No backend, routing, or data changes.

## Technical notes

- Tab component: lightweight inline buttons styled like the existing pills — not a shadcn Tabs primitive — so it matches the current visual language. Use `aria-selected` + `role="tab"` for a11y.
- Badge counts reuse hooks already wired for tools/collabs presence; if a count isn't trivially available, render a dot instead of a number for v1.
- `sessionStorage` key: `room-view:${roomId}` → `"chat" | "tools" | "gallery" | "collabs"`. Fallback to "chat".
- Keep `RoomViewMode` exported from `media-panel.tsx` for now to avoid a wider refactor; just stop rendering the switch inside the dock.
