Change the Group gallery utility strip so the "Add Work" control reads as inline clickable text instead of a bordered dashed box, sitting cleanly alongside the existing filter/sort/search controls.

Current state (verified in `src/routes/g.$slug.tsx`):
- `GroupWorkTab` renders `<AddMineToGroup group={group} entity="work" compact />` on the left of the utility strip.
- The `compact` variant still wraps the button in `rounded-2xl border border-dashed border-border bg-surface/60 p-3`, which creates the boxy look the user circled.

Changes:
1. Update `AddMineToGroup` so the `compact` variant renders the trigger as plain inline text (same sizing/color/hover as the adjacent "All" / "Recent" filter buttons) and removes the surrounding dashed box.
2. Preserve existing behavior: dropdown still opens below the text, lists the user’s works, and toggles tagging/untagging.
3. Leave the non-compact `AddMineToGroup` (used on the Collabs tab) unchanged so it keeps its bordered empty-state-style button.

No backend, data, or auth changes. Only presentation code in the existing component.