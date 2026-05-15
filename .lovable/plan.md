## Goal

When everyone else has left an Instant Workshop, the remaining user shouldn't be stranded in an empty room. After **1 second alone**, show a prompt offering to drop into a new Workshop, with a 30-second countdown that auto-forwards to home.

## Trigger

Inside `ChannelView`, watch the media room presence. When `media.joined === true` and `others.length === 0`, start a **1-second** debounce timer. If still alone after 1s, open the "workshop wrapped" overlay. If anyone joins (or rejoins) during that 1s — or while the overlay is open — clear the timer / dismiss the overlay and reset state.

The 1s grace is just enough to ride out a single sync tick, not long enough to leave a vacant window sitting open.

## Overlay UX

- Centered modal (reuse `AlertDialog`) over the room view; doesn't unmount the room so reconnects cleanly cancel it.
- Title: "Workshop wrapped"
- Body: "You're the only one left. Want to drop into a new Instant Workshop?"
- Live countdown: "Returning home in **Ns**…" (updates each second)
- Two actions:
  - **Primary** "Join new Workshop" — calls `joinLounge` server fn, navigates to `/instant/$id` with mode preserved (`video` if camera currently on, else `voice`). Permissions already granted in current room, so no re-prompt.
  - **Secondary** "Back to home" — immediate `handleExit()` (leaves media + navigates to `/`).

## State and timers (in `channel-view.tsx`)

- `aloneTimerRef = useRef<number | null>(null)` — the 1s debounce.
- `[endedOpen, setEndedOpen] = useState(false)` and `[secondsLeft, setSecondsLeft] = useState(30)`.
- Effect on `[media.joined, others.length]`:
  - If `media.joined && others.length === 0 && !endedOpen` → start 1s timer that flips `endedOpen = true` and resets `secondsLeft = 30`.
  - Else clear the timer; if `others.length > 0`, also close the overlay and reset countdown.
- Effect on `endedOpen`: when true, run a `setInterval` 1s decrementing `secondsLeft`; at 0 → `handleExit()`. Clear on close.
- If `media.joined` flips false (manual exit), clear everything.

## Interaction with the inactivity (mute + cam off) warn

Suppress the existing inactivity `warnOpen` dialog while `endedOpen` is true — gate the inactivity effect on `!endedOpen`.

## Joining a new workshop

Reuse `joinLounge` via `useServerFn`. Mode mirrors current `instant.index.tsx`:
- If `media.cameraOn` (or `media.mode === "video"`), pass `mode: "video"`; else `"voice"`.
- Toast on error, fall back to `/instant` on failure.

## Files

- `src/components/channel-view.tsx` — add state/refs/effects, render `<AlertDialog>` for the "workshop wrapped" prompt, gate inactivity warn on `!endedOpen`. No changes to media hook, server fn, or DB.

## Out of scope

- Server-side cleanup of abandoned rooms (presence already drives UX).
- Matchmaker / 5-cap changes.
- Fullscreen-specific styling (AlertDialog portals above both layouts).