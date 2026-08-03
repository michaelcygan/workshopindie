# Placeholder composer button for the mobile action island

## Problem
On editor pages like `/me/blog/:id` the mobile action island is still visible, but the real floating composer trigger is intentionally hidden (so users aren't prompted to create new content while editing). That leaves a visual gap in the center of the island between the left tabs and right tabs, which the screenshot shows as awkward/empty.

## Goal
Fill the center gap with a non-interactive placeholder that matches the size and visual weight of the existing composer trigger, but does not open anything or navigate anywhere.

## Changes
1. **Update `src/components/mobile-island/mobile-action-island.tsx`**
   - When `composerVisible` is false, render a center placeholder in the same grid column where `MobileComposerTrigger` normally appears.
   - The placeholder should be a `div` (not a button) so it is not focusable, clickable, or announced by screen readers.
   - Use `aria-hidden="true"` and `tabIndex={-1}` (if any element is used).
   - Match the dimensions of `MobileComposerTrigger` (a `h-12 w-12` rounded-full) and use a subtle, muted style (e.g., `bg-muted/40` or `border border-border/50`) so it reads as a quiet spacer, not an active control.
   - Keep the existing `grid-cols-[1fr_auto_1fr]` layout so the left/right tab groups remain balanced around the center.

## Out of scope
- No new behavior, navigation, or menu will be wired to the placeholder.
- No changes to the real composer trigger or its menu logic.
- No changes to other routes or visibility rules.