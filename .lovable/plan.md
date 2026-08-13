# Ambient rotation for the three featured stories

Keep the current featured block exactly as designed, but let the three stories take turns being the lead (big image + excerpt + byline), with a calm crossfade/glide.

## Behavior

- Every ~7 seconds, the three featured posts rotate positions: lead moves to the bottom of the two compact rows, the first compact row becomes the new lead.
- Transition: lead image and lead text crossfade (opacity plus a 6-8px vertical drift, ~600ms, soft easing). The two compact rows shift with the same timing so the change reads as one gliding move, not three separate ones.
- Nothing resizes or reflows: the lead image keeps its 16:10 box and the compact rows keep fixed heights, so the page never jumps mid-rotation. Excerpt stays clamped to 3 lines.
- A slim progress hairline under the "Featured story" eyebrow can indicate the cycle (optional, subtle, cobalt at low opacity) — included by default, easy to drop.

## Restraint rules

- Pauses on hover or keyboard focus anywhere in the block, and resumes on leave.
- Pauses when the block is off-screen (IntersectionObserver) and when the tab is hidden.
- `prefers-reduced-motion`: no rotation at all, static lead as today.
- Links keep working normally throughout; no click is ever intercepted by the animation.
- No dots or arrows — the block stays chrome-free, matching the current design.

## Scope

- Only `src/components/home/public-featured-stories.tsx` changes. Same component is used by `/blog` and the logged-out homepage, so both get the behavior.
- No data, server, or token changes; still uses the three posts already passed in. If fewer than three posts, rotation is skipped.

## Technical notes

- Local `leadIndex` state with a `setInterval`, cleared on unmount; rotation order derived from the incoming `posts` array so keys stay stable.
- CSS transitions on opacity/transform keyed off the post id, so React reuses DOM nodes and images do not re-fetch or flash.
- Images for all three get eager/`loading="eager"` on the lead and preload on the others to avoid a blank frame on first rotation.
