# Optimize Blog index spacing and filter widths

Tighten the vertical rhythm on `/blog` and make the Topic filter the same width as the Medium filter so long topic names fit.

## What changes

1. Reduce top padding overall:
   - Tighten the masthead block (`py-5 md:py-7` → something like `py-4 md:py-5` and reduce the title/description gap if needed).
   - Tighten the control row (`py-3` → `py-2.5` or `py-2`).
   - Reduce the first section's top padding (`BlogLatestStories` `py-10 md:py-14` → `py-8 md:py-10`).

2. Equalize Topic and Medium filter widths:
   - Apply a shared `min-width` (e.g. `min-w-[10rem]` or similar) to both Topic and Medium `<select>` pills in `src/routes/blog.index.tsx` so the Topic dropdown is the same size as the Medium dropdown and long topic names display comfortably.

## Files to edit

- `src/routes/blog.index.tsx` — masthead and control row padding; select pill widths.
- `src/components/blog/blog-editorial-sections.tsx` — first band top padding.

## Verification

- Preview `/blog` at desktop and mobile widths; confirm the masthead/control row feels compact and the Topic and Medium pills are the same width.
- Confirm no horizontal overflow or clipped topic text on mobile.
