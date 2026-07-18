## Chat container: fill the sidebar height

The red line sits near the bottom of the Recent Works module — meaning the chat card should stretch to match the full right-sidebar height, not size to its own content. My last pass went the opposite way (`self-start` + fixed clamp), which is why it still ends short.

### Changes in `src/components/group/group-today-tab.tsx`

1. **Chat `<section>`**: remove `self-start` and switch to full-height flex so the grid row stretches it to match the sidebar.
   - `flex flex-col self-start overflow-hidden …` → `flex h-full flex-col overflow-hidden …`
2. **Messages scroller**: drop the fixed `xl:h-[46vh]` clamp and let it fill remaining space inside the card.
   - `h-[clamp(180px,26vh,300px)] … xl:h-[46vh]` → `h-[clamp(220px,32vh,340px)] … xl:h-auto xl:flex-1 xl:min-h-0`
   - Keeps mobile clamp intact; on `xl` the scroller grows/shrinks to fill whatever height the sidebar dictates.
3. **Signed-out placeholder**: mirror the same responsive height so the card doesn't collapse when the viewer is logged out (`xl:h-auto xl:flex-1`).
4. **Grid wrapper**: remove `items-start` (added last pass) so the row stretches both columns to equal height again.

### Out of scope
- No sidebar module changes, no composer changes, no DB.
