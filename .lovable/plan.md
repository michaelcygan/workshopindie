Update the desktop top navigation (`src/components/top-nav.tsx`) to match the requested structure.

1. Remove the `HoverMoreMenu` component and its import (`ChevronDown`).
2. Remove the `More` trigger from the center nav.
3. Add a direct `Link to="/gallery"` labeled "Work" in the center nav.
4. Reorder the center nav links to: Lounge, Groups, Collabs, Events, Work.
5. Keep the "In Progress" link accessible only via the user avatar dropdown (My stuff) — it is already there and will remain.

The mobile bottom nav (`src/components/mobile-nav.tsx`) already has its own structure and is not affected by this change.