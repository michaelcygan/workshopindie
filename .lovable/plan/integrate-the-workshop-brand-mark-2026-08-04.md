# Integrate the Workshop brand mark

Swap the animated orange dot in both headers for the supplied circular W/ mark, keeping the serif "Workshop" wordmark beside it. Narrow asset pass only — no homepage, nav, or auth behavior changes.

## What changes

- Copy the supplied SVG verbatim to `public/brand/workshop-logo-mark.svg` (stays an SVG; no retracing, recoloring, or rasterizing).
- New shared component `src/components/workshop-brand-link.tsx`:
  - Links to `/`, `aria-label="Workshop home"`.
  - Renders the mark via `<img src="/brand/workshop-logo-mark.svg" alt="" aria-hidden width/height fixed>` with `object-contain shrink-0 dark:invert` so it stays visible on the dark theme and reserves space before load.
  - Renders the visible "Workshop" wordmark in the existing display serif.
  - `size` variant: `compact` (mark 24x24, `text-base`, gap ~7px) and `default` (mark 28x28, `text-lg`, gap ~8px).
  - Keeps the current rounded hover (`hover:bg-muted`) and keyboard focus ring; `whitespace-nowrap`, vertically centered.
- `src/components/mobile-brand-header.tsx`: replace the dot + wordmark block with `<WorkshopBrandLink size="compact" />`. Header stays `h-11`; Sign in / Join untouched.
- `src/components/top-nav.tsx`: replace the dot + wordmark block with `<WorkshopBrandLink />`. Header stays `h-14`; the three-column flex-1 layout that centers the nav is untouched, as are all auth branches.
- Favicon: because this is the brand mark, also copy it to `public/favicon.svg` and point the `{ rel: "icon" }` link in `src/routes/__root.tsx` at it (`type: "image/svg+xml"`), removing `public/favicon.ico`.

Nothing else is touched: the global `gradient-motion` style stays (used elsewhere), only the two dot spans are removed.

## Verification

- Playwright screenshots of the header at 355px and 390px mobile and at desktop, in light and dark, logged-out and authenticated; confirm no clipping, overflow, height change, or off-center desktop nav.
- Typecheck and production build.
