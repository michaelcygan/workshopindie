## Goal

Make `/workshop` an instant "I get it" page. No dropdown hunt, no ambiguity between Drop In and Host — the live rooms should be visible the second the page loads, and starting one (or opening the first) should be one click.

## What's wrong today

- "Drop in" hides live topics behind a `LoungeForkDropdown` — users must open it to see what's happening.
- Two equally-weighted cards (Drop in / Host) force a decision before showing context.
- Topic chips on the Host card duplicate the dropdown taxonomy; nothing tells users "no one's live in Painting yet — you'd open the first room."
- Device status, captions, and the WorkshopStrip push the live rail far below the fold.

## Redesign — single decision surface

```text
┌───────────────────────────────────────────────────────────────┐
│ Workshop  • 3 live                              [mic][cam] ok │
│ Drop into a live room, or start your own. 5 seats per room.   │
├───────────────────────────────────────────────────────────────┤
│  LIVE NOW                                                     │
│  ● Any topic     2 live   [ Take a seat ]                     │
│  ● Music         1 live   [ Take a seat ]                     │
│  ● Writing       —        [ Open the first room ]   ← dashed  │
│  ● Painting      —        [ Open the first room ]             │
│  + see all topics ▾                                           │
├───────────────────────────────────────────────────────────────┤
│  Want host controls?  [ Spin up your own room → ]             │
└───────────────────────────────────────────────────────────────┘
```

Key moves:

1. **Inline live topics list** replaces the dropdown. Each row = one tap to enter. Live rows show pulsing dot + count + ink "Take a seat" button; empty rows show muted "Open the first room" (still one tap, calls `joinMediumLounge` which already opens an empty room).
2. **"Any topic"** stays pinned at the top — it's the matchmaker default and matches today's behavior.
3. **Top ~5 topics shown by default**, rest collapse under a "+ see all topics" toggle so the page doesn't become a wall of chips.
4. **Host demoted to a secondary action** — single full-width outlined button below the live list. Opens the existing `HostPrivacyDialog` unchanged.
5. **Header live counter** stays, but the redundant "Drop in / Host" cards collapse into the structure above.
6. **Device status** moves to a compact inline chip next to the title (already small, just relocated). Error message only appears if blocked.

## Files to change

- `src/routes/workshop.index.tsx` — replace the two-card grid with the live-topics list + secondary Host button. Reuse existing handlers (`handleDrop`, `handleJoinNow`, `handleHost`, `confirmHost`) verbatim.
- `src/components/lounge-fork-dropdown.tsx` — extract the rooms query into a small new component `src/components/live-topics-list.tsx`, OR keep the dropdown for other callers and add the new list as a sibling. Plan: new file `live-topics-list.tsx` that takes `onPick(medium | null)` and `onLiveCountChange`, leaving `LoungeForkDropdown` untouched (it's used elsewhere indirectly via this same page only — safe to leave as backup but the page won't render it).
- No backend changes. No new server functions. Same `listActiveInstantRooms`, `joinLounge`, `joinMediumLounge`, `hostInstantWorkshop`.

## Out of scope

- Changes to the in-room `/workshop/$id` experience.
- Changes to `/workshops` (scheduled workshops index) — that's a different page; the user mentioned "Workshop page" meaning `/workshop`.
- New taxonomy, new room kinds, or matchmaker logic changes.
- Visual overhaul of the LiveWorkshopsRail / WorkshopStrip below — they stay as-is.

## Technical notes

- The new `live-topics-list.tsx` polls `listActiveInstantRooms` every 5s (same cadence as today's dropdown) and derives the per-medium live map identically.
- Empty topics call `joinMediumLounge({ medium })` — the existing server fn already creates a room if none exists, so "Open the first room" needs no new code.
- Preserve the `preGrantMedia()` step before navigation so mic/cam permission is requested up front (unchanged).
- Keep the `canDrop` gate and the "Connect a mic or camera" guard.
