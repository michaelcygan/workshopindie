# Plan: Works categories + mobile category strip

## 1. Works-eligible categories

Add a derived list in `src/lib/categories.ts`:

```ts
export const WORK_CATEGORIES = CATEGORIES.filter(c =>
  ["film","music","writing","build","visual"].includes(c.id)
);
```

Use `WORK_CATEGORIES` (not `CATEGORIES`) in:
- `src/routes/index.tsx` → `GalleryControls` tabs
- `src/routes/works.new.tsx` → category picker (verify it currently uses full list)

Workshops, Collab, Onboarding, Cities keep using full `CATEGORIES`.

Note: this is a UI filter only. No DB change — existing works already only use these 5 in practice, and any stray rows just won't be filterable from the chip strip (they'd still appear in "All").

## 2. Mobile auto-scrolling category strip

Refactor `GalleryControls` in `src/routes/index.tsx` into a small component that, on mobile (<768px), renders the category chips as a single-line horizontally scrolling marquee. Desktop keeps the current wrapped pill bar.

Behavior:
- Single line, `overflow-x-auto`, `whitespace-nowrap`, hide scrollbar
- Duplicate the chip list once and translate the inner track with a CSS keyframe (`marquee-x`) running ~30s linear infinite
- Pause on `:hover`, `:focus-within`, and while `touch-active` (use `onTouchStart`/`onTouchEnd` to toggle a `paused` class, or pause via `:active` on the container)
- Tapping a chip still selects the filter (handler unchanged)
- Respect `prefers-reduced-motion`: disable animation, allow manual horizontal swipe instead
- Sort/Newest/Trending bar stays as-is (already short)

CSS additions in `src/styles.css`:
```css
@keyframes marquee-x {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.animate-marquee-x { animation: marquee-x 30s linear infinite; }
.animate-marquee-x.is-paused,
.animate-marquee-x:hover { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .animate-marquee-x { animation: none; }
}
```

## Files

- `src/lib/categories.ts` — add `WORK_CATEGORIES`
- `src/routes/index.tsx` — use `WORK_CATEGORIES`; new marquee chip row for mobile
- `src/routes/works.new.tsx` — switch picker to `WORK_CATEGORIES` if it currently lists all 8
- `src/styles.css` — `marquee-x` keyframe + utility

No DB, no schema, no new deps.
