# Align the Recent Work carousel with the rest of the homepage

On the logged-out homepage, the first thumbnail in the "Recent Work" carousel does not start on the same left edge as the "Made on Workshop" eyebrow and the "Recent Work" heading. On mobile it sits about 24px further right; on desktop about 32px further right. The result is that the row of Work cards looks visually detached from the section it belongs to.

## What changes

- The carousel row starts exactly on the page's content edge, so the left edge of the first thumbnail lines up with "Recent Work" and with every other section of the page (Latest Stories, Open Calls, footer).
- Cards still scroll horizontally and still bleed off the right edge of the screen, which signals that there is more to scroll.
- No change to card size, spacing between cards, imagery, captions, or the "Browse the Gallery" link.

## Technical detail

In `src/components/home/public-recent-work-carousel.tsx`, the scroll container currently cancels the section padding with `-mx-4 md:-mx-6` and then re-adds a larger inset with `px-10 md:px-14`. Change the scroll container's horizontal padding to match the section padding (`px-4 md:px-6`) so the first card aligns with the heading while the negative margin keeps the full-bleed scroll behaviour intact.
