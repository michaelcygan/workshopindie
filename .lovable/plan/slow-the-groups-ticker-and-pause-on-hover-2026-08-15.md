# Slow the Groups ticker and pause on hover

## Goal
Reduce the scroll speed of the "Live across Groups" ticker on the Groups home page by half and make it pause when the user hovers over it.

## Current state
- The ticker is implemented in `src/components/groups-activity-ticker.tsx` as the `GroupsActivityTicker` component.
- It is rendered on both the logged-in and logged-out Groups home pages (`member-groups-home.tsx` and `public-groups-home.tsx`).
- The marquee animation currently uses `animation: groups-activity-ticker 120s linear infinite`.
- It already has a hover-pause rule (`group-hover:[animation-play-state:paused]`), but it is tied to a Tailwind `group` utility and can be made more robust with an explicit container-level hover rule.

## Changes
1. In `src/components/groups-activity-ticker.tsx`:
   - Change the animation duration from `120s` to `240s` to halve the scroll speed.
   - Replace the Tailwind `group-hover` pause rule with an explicit CSS rule so that hovering anywhere on the ticker container pauses the marquee.
   - Keep the existing `motion-reduce:animation-none` accessibility behavior.

## Verification
- Open the Groups page preview and confirm the "Live across Groups" marquee moves noticeably slower.
- Hover over the ticker and confirm it pauses; moving the cursor away resumes it.
- No other tickers (e.g., scene ticker, group news ticker) should be affected.
