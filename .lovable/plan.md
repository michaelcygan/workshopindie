# Monochrome + Cobalt UI Refinement

Typography foundation is already in place: Archivo is loaded as `--font-display`, Inter as `--font-sans`, Fraunces is gone, and the circular W/ mark is live in `WorkshopBrandLink`. So this pass is purely the visual-language refinement — no layout redesign, no route, schema, or behavior changes.

## What changes

Workshop moves from coral/animated-gradient community styling to a black, cream, and white foundation with one restrained signal color (Blueprint Cobalt, ~#3157E0). Geometry gets flatter and more architectural: smaller radii, hairline rules instead of decorative shadows, compact confident actions.

## Wave 1 — Tokens and primitives

**Color tokens (`src/styles.css`)**
- `--primary` becomes near-black ink with white foreground in light theme; warm white with near-black foreground in dark.
- Add `--signal`, `--signal-foreground`, `--signal-soft` (cobalt, with a lighter dark-theme value) and map them in `@theme inline` so `bg-signal` / `text-signal` / `border-signal` exist.
- `--ring` becomes cobalt with an offset; `::selection` becomes cobalt-soft instead of pink.
- Keep destructive red, and semantic green/amber wherever success/warning/live states use them.
- Keep the warm cream canvas, the category tint palette, and `--violet` / `--primary-warm` / `--primary-deep` tokens in place (they still have product-specific uses); they stop being general UI styling but are not deleted.

**Radius scale**
- `--radius-sm: 6px`, `md: 8px`, `lg: 10px`, `xl: 12px`, `2xl: 16px`, `--radius: 8px`.
- This alone re-geometries most of the app, since primitives read from the scale.

**Gradients**
- `.gradient-motion`, `.text-gradient-motion`, `.icon-gradient-motion` stop being used for general controls. The utilities stay defined for the small number of intentionally expressive spots (Plus/premium moments), but 46 files currently reference them — general-purpose buttons, links, and headings get switched to ink/cobalt.
- `.speaking-halo` keeps its warm treatment (it signals live audio, a real semantic state).

**Primitives** — `button`, `card`, `input`, `textarea`, `select`, `dialog`, `sheet`, `drawer`, `tabs`, `badge`, `popover`, `dropdown-menu`, `alert-dialog`, `separator`, `switch`, `progress`:
- Button variants: default = black/white flat 8px; secondary = neutral surface, black text; outline = paper with ink hairline border; ghost = transparent with subtle gray hover; link = ink with underline, cobalt on hover/active; destructive = semantic red. No gradients, no scale/bounce/glow — color and surface shifts only. Cobalt `focus-visible` ring with offset. Touch targets and sizes unchanged.
- Cards/panels flatten: hairline borders and surface contrast replace decorative shadows. Shadows kept only on menus, popovers, dialogs, toasts, and floating mobile controls.
- Tabs get an active cobalt rule; badges get compact rounding except where they are semantically chips.

Build and inspect before continuing.

## Wave 2 — Shared chrome

- `WorkshopBrandLink`: confirm no pill/colored container, mark stays black in light and light in dark.
- `TopNav` + `MobileBrandHeader`: Join button becomes a compact black 8px rectangle instead of an orange capsule; nav hover/active use ink and cobalt.
- `SiteFooter`, page headers, shared empty states, filter/tab treatments.
- Mobile action island becomes a structured rounded rectangle (still touch-friendly, still floating with elevation).

Build and inspect again.

## Wave 3 — Targeted surface corrections

Visual review and spot fixes only, on: logged-out homepage, member home, blog index/article/editor/publish flow, collabs index and detail, groups index / group detail / Today, work detail, public profile, messaging, and representative dialogs, sheets, forms, and empty states. Corrections are limited to leftover coral, oversized radii, stray gradients, and shadow-vs-border cleanup — no route is manually redesigned.

## Guardrails

No schema, API, route, auth, publishing, tagging, moderation, or realtime changes. No new dependencies. Nothing becomes uniformly square or uniformly pill; avatars, presence dots, toggle tracks, status/filter chips, circular icon buttons, progress rings, and the W/ mark stay circular. Accessibility labels and tap targets preserved. Light and dark both verified.

## Verification

Production build and lint clean; mobile and desktop screenshots of the homepage, a member surface, and a form/dialog in both themes.
