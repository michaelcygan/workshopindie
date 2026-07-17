## Problem
The floating "route → route · title" pill on the landing globe renders an `<a href="/works/…">` inside a label div that intercepts click and calls `router.navigate({ to: href })`. Two issues make the click a no-op:

1. `router.navigate({ to: <raw string> })` — TanStack Router's typed navigate does not always resolve dynamic string paths like `/works/some-slug` or `/g/some-slug`; the click is swallowed by `e.preventDefault()` and nothing happens.
2. The inner `<a>` sits inside a div with Tailwind's `pointer-events-none`. The RAF loop flips the parent's inline `pointerEvents` to `auto` only when an active promo with `href` is drawn — in rapid frame updates the anchor briefly loses pointer events, so the mouseenter/click that would "freeze" the pill sometimes misses.

## Fix
**File:** `src/components/world-arcs.tsx`

1. **Reliable SPA navigation** — replace `router.navigate({ to: href })` with `router.history.push(href)`, which accepts any string path and performs a client-side navigation.
2. **Guaranteed hit target** — add `pointer-events-auto` on the inner `<a>` template so the link is always clickable once rendered (line 494), independent of the RAF-controlled parent inline style.
3. **Fallback** — if `router.history.push` is unavailable, `window.location.assign(href)` as a last resort inside the same click handler.

No changes to the pill visual, promo data pipeline, or globe animation.

## Scope
- One file: `src/components/world-arcs.tsx`
- Click handler + one class on the anchor template string
