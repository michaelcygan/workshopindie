## Problem

In `src/components/channel-view.tsx`, the Chat view renders `<PinnedMessage>` as a sibling *above* the scrollable messages container. The scroll container itself has a fixed height (`h-[clamp(280px,38vh,440px)] xl:h-[52vh]`). So when a pin appears, the pin's height is added on top of the chat area, pushing the composer below the viewport on laptop screens.

The other tab views (Gallery / Collabs / Links) don't have this issue because they don't render the pin above their fixed-height container.

## Fix

Keep the outer chat area a single fixed-height block, and let the pinned message consume space *inside* it (not on top of it).

In the Chat branch (around lines 1009–1029):

1. Wrap `<PinnedMessage>` + the scrollable `<div ref={scrollRef}>` in a single flex column with the same height clamp the scroll div uses today:
   ```
   <div className="flex h-[clamp(280px,38vh,440px)] xl:h-[52vh] flex-col">
     <PinnedMessage … />           ← natural height, shrink-0
     <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6"> … </div>
   </div>
   ```
2. Remove the height clamp from the inner scroll `<div>` (it becomes `flex-1 min-h-0`), and move the clamp to the new wrapper.
3. Leave `ChatPolls` where it is (above the wrapper) since it wasn't part of the reported regression; only the pin was pushing the composer out.

Result: total Chat block height is unchanged whether or not a message is pinned. The pinned banner just eats into the messages scroll area instead of extending the whole chat.

## Files touched

- `src/components/channel-view.tsx` — Chat branch only (~lines 1009–1029). No other components, no CSS tokens, no logic changes.
