## Fixes for news ticker

1. **Drawer drops down, not up**: Set `side="bottom"` and `align="start"` on `PopoverContent` in `src/components/group/group-news-ticker.tsx` so headlines open below the pill instead of above it.

2. **Hover-to-pause works reliably**: The current `.gnt-pill:hover .gnt-marquee` rule fails because the popover trigger sits inside the pill and animations don't pause when hovering child interactive elements consistently. Fix by:
   - Adding `onMouseEnter`/`onMouseLeave` handlers on the pill wrapper that toggle a `data-paused` attribute.
   - Switching the CSS to `.gnt-marquee[data-paused="true"] { animation-play-state: paused; }`.
   - Also pause while the popover is open (track `open` state from `Popover`).

No other files affected.