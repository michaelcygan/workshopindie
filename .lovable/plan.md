## Change

Replace the horizontal marquee `CategoryScroller` on the mobile profile Works tab with a single dropdown pill.

## Behavior

- Renders as one pill showing the current selection (defaults to "All").
- Tapping opens a dropdown listing all categories; selecting one closes the menu and updates the filter.
- The active item is checked in the menu; "All" is first.
- Desktop keeps the current wrapping pill row (no marquee issue there).

## Implementation

- Update `src/components/category-scroller.tsx`:
  - On mobile (`useIsMobile()`), render a shadcn `DropdownMenu` with a rounded-pill trigger styled to match existing filter pills (`rounded-full border border-border bg-surface px-3 py-1.5 text-sm` + `ChevronDown`).
  - Trigger label = label of the currently selected tab (fallback "All").
  - Menu items iterate `tabs`; onClick calls `onChange(t.id)`.
  - Remove the RAF auto-scroll, pointer-drag, and duplicated-list logic from the mobile branch.
  - Desktop branch unchanged.
- No API change — all call sites (`src/routes/u.$username.tsx`, etc.) keep passing `tabs`, `value`, `onChange`.

## Files

- `src/components/category-scroller.tsx`
