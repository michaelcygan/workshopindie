# Lounge "time remaining" countdown

Today the Lounge auto-closes an idle user after ~12 minutes total (10 min silent warn window, then a 2 min "Keep going?" grace period), but the timer is invisible — users only see the dialog when it's almost too late. This adds a visible countdown so nobody is surprised.

## What the user sees

1. **Idle countdown pill** in the Lounge header (next to the "Live · N/5" indicator).
   - Hidden while the user is active (mic on OR camera on OR recently interacted).
   - Once the user has been muted + camera-off continuously, a small pill appears:
     - `Auto-close in 9:58` — counts down the 10 min quiet window.
     - Turns amber at ≤2 min, red at ≤1 min.
   - Clicking the pill (or unmuting / turning camera on / moving the mouse in the Lounge) resets it and hides the pill.
2. **"Keep going?" dialog** already exists; add a live `m:ss` countdown inside it showing the 2 min grace before auto-leave, plus a clearer "Auto-leaving in 1:47" line. "Keep going" dismisses and resets.
3. Nothing changes for hosts ending the Lounge manually, or for the room-level lifecycle — this is purely the per-viewer idle timer surfaced visually.

## Technical notes

- All changes are in `src/components/channel-view.tsx`; no server, DB, or route changes.
- Reuse the existing `QUIET_WARN_MS` (10 min) and `QUIET_KICK_MS` (2 min) constants — the countdown is derived from the same `quietSince` timestamp that already arms the warn/kick timers, so the pill and dialog can never drift from the real close time.
- Add a `quietSince: number | null` state (set when mic+cam go quiet, cleared on any activity) and a 1 s `setInterval` that only ticks while `quietSince != null` to avoid unnecessary renders.
- Countdown pill is a small `rounded-full` chip matching existing header pill styling (border-border, text-[11px]); no new dependencies.
- Accessibility: pill uses `aria-live="polite"` so screen readers get updates without spamming; dialog countdown uses `role="timer"`.

## Out of scope

- Changing the 10/2 min thresholds.
- A room-wide "this Lounge closes at HH:MM" clock (rooms don't have a scheduled end — only the idle-viewer timer does).
