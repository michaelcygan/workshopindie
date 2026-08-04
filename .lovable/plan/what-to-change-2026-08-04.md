Add a little more leading padding to the Recent Work carousel so the first card thumbnail on mobile (and desktop) is not flush against the screen edge.

## What to change

- Modify `src/components/home/public-recent-work-carousel.tsx`.
- The carousel currently breaks out of its section with `-mx-4 md:-mx-6` and then re-adds `px-4 md:px-6` to the scroll container. This leaves the first thumbnail only 16px from the left edge of the viewport on mobile.
- Increase the scroll container’s horizontal padding (e.g., `px-4 md:px-6` → `px-5 md:px-8`) so the first card starts a little further from the edge. Keep the negative margin breakout so the carousel still spans the full width of the section.

## Verification

- Preview the logged-out homepage on mobile viewport (390px or similar) and confirm the first Recent Work thumbnail is visibly inset from the left edge.
- Confirm the rest of the layout remains unchanged and the carousel still scrolls correctly.
