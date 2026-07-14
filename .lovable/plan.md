# Make homepage globe pills clickable

## Problem

In `src/components/world-arcs.tsx`, the floating pill label is rendered by rewriting `label.innerHTML` on every animation frame with a raw `<a href="...">`. Two issues make it effectively unclickable:

1. **The label moves every frame.** Its `transform` is updated in the RAF loop to track the currently-active arc's endpoint, so as soon as you try to click, it drifts away or gets replaced by a different promo's pill.
2. **Raw `<a href>` bypasses TanStack Router**, so even a successful click triggers a full page reload instead of client navigation to `/works/:slug`, `/collab/:slug`, or `/g/:slug`.

## Fix (frontend / presentation only)

Edit `src/components/world-arcs.tsx`:

1. **Pause tracking on hover.** Add a `hoveredRef = useRef(false)` and wire `mouseenter` / `mouseleave` on the label element. While hovered:
   - Skip the `label.style.transform = ...` update and skip the `label.innerHTML = ...` rewrite in the RAF loop (keep the last frame frozen).
   - Keep opacity pinned at 1 so it doesn't fade out under the cursor.
2. **SPA navigation.** Attach a delegated `click` listener on the label div. On click, if the current promo has an `href`:
   - `e.preventDefault()`
   - Call `router.navigate({ to: href })` via `useRouter()` from `@tanstack/react-router`.
   - Keep the `<a href>` in the markup as a fallback (so middle-click / cmd-click still open in a new tab and it degrades gracefully).
3. **Guarantee hit area.** Ensure the label wrapper gets `pointer-events-auto` (not just the inner anchor) whenever an href is present — currently set via inline style, keep it, and add a small invisible padding hit-target so the pill has ≥28px tap height.
4. Track the currently-displayed promo in a ref (`currentPromoRef`) so the click handler always uses the pill the user actually sees, not a stale closure.

No changes to `globe-promos.ts`, routes, DB, or the arc rendering itself. All three kinds (`work` → `/works/:slug`, `collab` → `/collab/:slug`, `group` → `/g/:slug`) already have correct hrefs from `fetchPromos()`.

## Verification

- Hover the moving pill on the homepage globe → it should freeze in place.
- Click it → URL changes via client-side navigation to the work / collab / group page (no full reload flash).
- Cmd/middle-click still opens the target in a new tab.
