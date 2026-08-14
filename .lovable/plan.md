# Keep Featured Story rotation running on hover/focus

## What
The Featured Story slideshow currently pauses on mouse enter and keyboard focus, then resumes on leave/blur. The user wants it to continue cycling during hover/focus instead.

## Scope
- Only `src/components/home/public-featured-stories.tsx`.

## Changes
- Remove the `onMouseEnter`, `onMouseLeave`, `onFocusCapture`, and `onBlurCapture` handlers from the container.
- Keep the `paused` state for other pause triggers (off-screen via IntersectionObserver, hidden tab via `visibilitychange`, and `prefers-reduced-motion`).
- Ensure the progress bar continues to animate during hover/focus since rotation is no longer paused there.

## Pause rules that remain
- Off-screen (IntersectionObserver, `visible` state).
- Hidden tab (`document.hidden`).
- `prefers-reduced-motion: reduce`.

## Verification
- Typecheck the project.
- Confirm in the preview that the featured story keeps rotating while hovering over the hero image/text.
