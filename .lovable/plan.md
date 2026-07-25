## Goal
Make images inside blog post bodies clickable to open a full-screen lightbox. When a post has multiple images, the lightbox becomes a swipeable/clickable slideshow with prev/next controls.

Applies everywhere `BlogPostBody` renders: the full `/blog/$slug` page and the `BlogPostPeek` modal on profiles, on both mobile and desktop.

## Implementation

### 1. New component: `src/components/blog-lightbox.tsx`
- Fullscreen overlay (fixed inset-0, `z-[100]`, black/90 backdrop, `bg-black/95`).
- Props: `images: { src: string; alt: string }[]`, `index: number`, `onClose`, `onIndexChange`.
- Renders current image centered, `object-contain`, `max-h-[92vh] max-w-[95vw]`.
- Controls:
  - Close button (top-right, X icon, always visible).
  - Prev/Next buttons (chevrons, hidden if only 1 image). Desktop: side-anchored buttons. Mobile: bottom-corner buttons + swipe.
  - Counter "n / total" (bottom-center) when >1.
  - Caption (alt text) below image if present.
- Interaction:
  - Click backdrop → close. Click image → does not close.
  - Keyboard: `Esc` closes, `←`/`→` navigate.
  - Touch: horizontal swipe navigates (simple `touchstart`/`touchend` deltaX threshold ~50px).
  - Lock body scroll while open.
- Uses shadcn `Dialog` primitive or a plain portal; plain portal is simpler here to fully control layout, so use `createPortal` into `document.body`.

### 2. Update `src/components/blog-post-body.tsx`
- Before rendering, walk the markdown AST-rendered output isn't available, so instead: pre-scan the markdown string with a regex for `![alt](url)` and standalone `<img>` refs to build an ordered `images[]` list. Simpler and reliable: collect via the `img` renderer at render time using a ref-based collector (ordered by mount). Use a small `useRef<{src,alt}[]>` populated during render, plus each `img` receives its index.
  - Cleaner approach: parse markdown once with a regex `/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g` in a `useMemo` to build `images` and a `Map<src, index>`. The `img` renderer looks up its index by `src`.
- Wrap the `<img>` in a `<button type="button">` that calls `setOpen(true); setIndex(map.get(src))`.
- Add cursor-zoom-in class and subtle hover ring.
- Render `<BlogLightbox images={images} index={index} open={open} onClose onIndexChange />` at the end of the component.

### 3. No other call-site changes
`blog-post-peek.tsx` and `blog.$slug.tsx` already use `BlogPostBody`, so they get the behavior automatically. The lightbox portal sits above the peek modal via `z-[100]`.

### 4. Accessibility
- Lightbox root: `role="dialog" aria-modal="true" aria-label="Image viewer"`.
- Focus the close button on open; restore focus to the triggering thumbnail on close.
- Buttons have `aria-label` ("Close", "Previous image", "Next image").

## Out of scope
- Pinch-to-zoom inside the lightbox.
- Thumbnail strip.
- Preloading neighbors (can add later if needed).
