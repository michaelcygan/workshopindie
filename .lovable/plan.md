# Even out the two "Where you belong" modules

On desktop, the joined-groups thumbnail row and the "All groups" sidebar don't line up: the sidebar card runs noticeably taller than the thumbnails, so the bottom edges are ragged (the red line in the screenshot).

## What changes

- The two modules become the same height, top and bottom flush.
- The sidebar's height is driven by the thumbnail row, not by its own fixed list height. Its list scrolls inside whatever height is left, so a long list never pushes the card taller than the tiles beside it.
- The thumbnail row loses the extra bottom padding it reserves for a scrollbar, so its true bottom edge matches the card's.
- Mobile and tablet are unchanged — the sidebar is desktop-only there.

## Technical notes

- File: `src/components/groups/joined-groups-rail.tsx`.
- Grid already is `lg:grid-cols-[minmax(0,1fr)_280px]`; add `lg:items-stretch`, make the left column a flex column, and give the `aside` `h-full` with `flex flex-col`.
- Replace the sidebar's `max-h-[236px]` with `flex-1 min-h-0 overflow-y-auto` so it fills exactly the rail height.
- Drop `pb-2` from the scroller on `lg` (keep the hidden-scrollbar utilities) so the bottom edges are truly flush.
