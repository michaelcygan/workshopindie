# Archivo identity pass: type system built around the W/ mark

A typography and calibration pass only. No layout, route, data, auth, or content changes. Colors, borders, radii, imagery, and composition stay as they are.

## Wave 1 — Global type foundation

- `src/routes/__root.tsx`: drop Fraunces from the Google Fonts request, add `Archivo:wght@400;500;600;700`, keep the existing Inter weights and the same `<link>` loading approach (preconnect + stylesheet, `display=swap`).
- `src/styles.css`:
  - `--font-display: "Archivo", "Helvetica Neue", Arial, sans-serif;` (token name unchanged, so every existing `font-display` usage inherits it).
  - `.font-display` tracking moves from `-0.01em` to `-0.02em`; no forced weight, so component-level weight utilities keep controlling hierarchy.
  - Update stale comments describing the serif/"Stripe + Partiful" direction.
- Build after this step before continuing.

## Wave 2 — One brand lockup

- `src/components/workshop-brand-link.tsx`: wordmark becomes Archivo SemiBold (`font-semibold`, `tracking-[-0.03em]`), optically centered against the mark, gap nudged if needed. Mark sizes (24px compact / 28px default), header heights, hover, focus ring, and link behavior unchanged.
- `src/components/site-footer.tsx` (line ~191): replace the gradient dot + serif "Workshop" span with `<WorkshopBrandLink size="compact" />` so there is one lockup, not a competing footer copy. The `gradient-motion` class stays in the file — it is still used by the Join/subscribe buttons.

## Wave 3 — Shared title primitives and eyebrow labels

Add `font-display` (plus the tracking below) to the shared title components so hierarchy propagates without per-page edits:

- `CardTitle` — `font-display tracking-[-0.01em]`
- `DialogTitle`, `AlertDialogTitle`, `SheetTitle`, `DrawerTitle` — same treatment
- Only the title elements change; card bodies, descriptions, and controls stay Inter.

Eyebrow labels: the homepage components already sit at `tracking-[0.16em]`/`0.24em`. Standardize section eyebrows to `font-semibold tracking-[0.12em]` and byline/metadata eyebrows to `tracking-[0.1em]`, touching only the eyebrow spans in `src/components/home/*` (notably `public-home.tsx`'s `0.24em` masthead label and the `0.16em` section labels). No headline is uppercased.

## Wave 4 — Visual QA and targeted fixes

Playwright pass at ~390px, 768px, and 1440px, light and dark, logged-out and (where a session is available) signed-in, across: homepage, blog index and article, gallery, groups index/detail, collabs index/detail, work detail, public profile, an editor form, and a dialog/sheet. Check header lockup vs. auth actions at 350–390px, title wrapping, no clipping or overflow, tap-target sizes.

Fix only genuine exceptions at the affected shared component or breakpoint — no global type-scale shrink, no per-page overrides otherwise.

Finish with `npm run build` and lint.

## Technical notes

- No new package: Archivo is loaded via the existing Google Fonts `<link>` in the root route head, per the Tailwind v4 rule against URL `@import` in `styles.css`.
- `--font-display` and `.font-display` keep their names, so no search-and-replace across routes.
- The mark SVG is unchanged; `dark:invert` continues to handle dark theme visibility.
