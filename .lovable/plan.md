# Fix: group news ticker missing on mobile

## What's happening

The ticker isn't broken — it's deliberately hidden on phones. In the group Today tab, both the logged-out and logged-in branches wrap the news rail in a `hidden md:block` container, so it only ever renders at tablet width and up.

The data side is healthy: the public news endpoint for Chicago returns real headlines right now, so once the ticker renders on mobile it will have content.

## The fix

1. Remove the desktop-only wrapper so the ticker renders at every width in both the logged-out and logged-in Today views.
2. Place it consistently: directly under the section/tab bar area at the top of the Today content on mobile, so it reads as a scene-level signal rather than a stray strip at the bottom.
3. Mobile polish inside the ticker component:
   - Keep the anchored label chip tappable (it opens the headlines list), but let the label text stay hidden on the narrowest widths as it already does.
   - Slightly tighter height/text on small screens so it doesn't compete with the hero.
   - Keep the existing reduced-motion fallback and the tap-to-open headlines popover, which is the primary mobile interaction since hover-to-pause doesn't exist on touch.
4. Render nothing (as today) when a group has no feed or no items, so groups without a news source are unaffected.

## Technical notes

- `src/components/group/group-today-tab.tsx` — drop the two `<div className="hidden md:block">` wrappers around `GroupNewsTicker` and move the ticker to the top of each branch.
- `src/components/group/group-news-ticker.tsx` — responsive height/typography tweaks only; no data-fetch changes. Endpoint `/api/public/group-news/$slug` stays as is.
- No database or server changes.
