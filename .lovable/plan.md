## Problem

The "What people are working on" module reuses the full `CollabCard` and `WorkCard` primitives, but the module lives in a narrow event-page column. At that width the cards break:

- **Collab card**: top row (category chip + "Open · Casting" state badge + relative time) is a single non-wrapping flex row → "Open" and "Casting" get clipped, title `text-[22px]` line-clamp-2 still truncates aggressively, footer row (avatar · name · location · Comp TBD) overflows so name gets clipped and "Comp TBD" wraps to a new visual line.
- **Work card**: category chip + a second "Portfolio" chip sit on the cover in an absolute row that overlaps at narrow widths; title clamps hard; the shared `AttendeeChip` below the card wraps to two lines ("Mike / Cygan · going") because the module renders it in a wider chip container than collabs use.

## Fix (presentation only, scoped to the attendee module)

Keep the underlying `CollabCard` / `WorkCard` untouched everywhere else. In `src/components/event-attendee-work.tsx`:

1. **Force single-column on the fair grids in this module** (they render 3–4 up on desktop today, which is what makes each card too narrow inside the event sidebar). Use `grid-cols-1 sm:grid-cols-2` for both collabs and works so each card gets ≥ ~280px, and let the module rely on "See everyone" to expand.
2. **Wrap the AttendeeChip in `whitespace-nowrap`** and truncate the name so it always renders on one line matching the collab tab. Add a small `max-w-full` + `truncate` on the name span.

In `src/components/collab-card.tsx` (tiny resilience pass, no visual change at normal widths):

3. Change the header chip row from a single flex line into `flex flex-wrap items-center gap-2` and move the timestamp into its own trailing element with `ml-auto shrink-0` — chips wrap instead of clipping when width < ~320px.
4. Give the title `break-words` and drop to `text-[20px]` at narrow widths (`text-[20px] sm:text-[22px]`) so the two-line clamp fits.
5. In the footer meta row, add `min-w-0` to the author name span and `flex-wrap` fallback so "Comp TBD" doesn't push name off-screen.

In `src/components/work-card.tsx`:

6. Ensure the category + kind chip overlay uses `flex flex-wrap gap-1` (not absolute overlap) and add a subtle backdrop so chips never sit on top of each other.
7. Add `line-clamp-2 break-words` to the title.

## Out of scope

No data/server changes, no changes to the CollabCard/WorkCard usage on other pages beyond the wrapping/typography resilience noted above.
