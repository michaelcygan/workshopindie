## Problem

On mobile, the collab detail page header (`src/routes/collab.$slug.tsx` lines ~354–414) stuffs the category chip, state badge, "Posted today" chip, and up to 5 owner actions (Share, Edit, Pin, Close, Delete) into one horizontal row. The row overflows the viewport, so a delete-icon button sits partially off-screen and the whole page reads as "zoomed out" because the row forces horizontal scroll / shrink.

Non-owners can hit a similar overflow when Leave + Report are both present next to Share.

## Fix

Restructure that header into two rows on mobile, and collapse secondary owner actions behind a kebab (`⋯`) dropdown menu. Desktop stays exactly as today.

### Row layout

Row 1 — status/context chips (wrap allowed):
- Category chip
- State badge (Open · Casting, Draft, Closed, etc.)
- "Posted today" / "Open Nd" chip
- "Closes in Nd" chip when applicable

Row 2 — actions, right-aligned:
- Always visible: `Share`
- Owner, mobile: single primary action visible inline based on state:
  - Draft → `Publish`
  - Open → `Edit`
  - else → `Pin/Pinned`
- Owner, mobile: everything else moves into a `DropdownMenu` triggered by a kebab icon button:
  - `Edit` (when not the inline primary)
  - `Pin` / `Unpin` (when not the inline primary)
  - `Close` (when open)
  - `Delete` (destructive, styled red)
- Owner, desktop (`sm:` and up): keep the current flat row — all buttons inline, no kebab.
- Non-owner: `Share` + inline `Leave` (if member) + `Report`; if both Leave and Report are present on mobile, fold `Report` into the same kebab.

### Structural change

Replace the single `<div className="mb-4 flex items-center gap-2">` wrapper with:

```
<div className="mb-4 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
  <div className="flex flex-wrap items-center gap-2 min-w-0">
    {chips}
  </div>
  <div className="flex items-center gap-2 sm:ml-auto justify-end">
    {actions}
  </div>
</div>
```

- Add `min-w-0` on the chip container and `truncate` where needed so long state sublabels can't push the row wide.
- Confirm handlers (`confirm(...)`) currently called from Close/Delete/Leave stay identical; only the trigger surface moves into `DropdownMenuItem`s.
- `PinCollabButton` gains an optional `variant="menu-item"` render path (or is wrapped by a small inline adapter in this file) so it can appear inside the dropdown without changing its click/toggle logic. Icon + label + toast behavior unchanged.

### Files touched

- `src/routes/collab.$slug.tsx` — header block only (lines ~354–414). No changes to data fetching, mutations, or the rest of the page.
- `src/components/pin-collab-button.tsx` (only if needed to render inside a `DropdownMenuItem`; otherwise wrap inline in the route file).

### Out of scope

- No copy changes to badges, chips, or button labels.
- No changes to the "Share it — that's how applicants find you" nudge card below the header (that one already fits).
- No changes to bottom nav, back-to-profile link, or the rest of the page layout.

## Verification

1. Switch preview to mobile (375px). Confirm:
   - Chips wrap onto one row without horizontal scroll.
   - Actions sit on their own row, right-aligned, fully visible.
   - Kebab opens a menu containing Edit/Pin/Close/Delete as applicable.
   - Delete item is styled destructively and still shows the `confirm(...)` dialog.
2. Switch to desktop. Confirm the row looks unchanged from today (all owner buttons inline, no kebab).
3. Log-out view: header still shows chips + Share, no owner actions.
