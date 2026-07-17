## Fix: gallery cards square off at top corners on hover

### Cause
In `src/routes/g.$slug.tsx` the group Gallery card is a `rounded-2xl` bordered `<Link>` (no `overflow-hidden`, so the author avatar can overhang), containing a `rounded-t-2xl overflow-hidden` image wrapper whose inner `<div>` scales to `1.03` on hover while the outer Link simultaneously runs `hover:-translate-y-0.5`. Chrome loses sub-pixel precision on the rounded clip mask during that combined transform, so the top-left/top-right corners visibly flatten to square on hover. It is not the avatar or the shadow.

### Change (one file)
`src/routes/g.$slug.tsx`, gallery card only (around lines 1039–1046):

1. On the image wrapper (`div` currently `relative h-32 w-full overflow-hidden rounded-t-2xl`) add `isolate` and `transform-gpu` so the rounded clip is promoted to its own compositor layer and the mask stays crisp while the parent translates.
2. On the inner scaling div (currently `absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]`) add `will-change-transform` so the scale animates on its own layer instead of forcing the rounded mask to re-rasterize each frame.

No other files change. No radius, border, hover lift, avatar overhang, category chip, or shadow behavior is altered — only compositing hints on two elements of the gallery card.

### Verify
On `/g/chicago?t=work`, hover any card and confirm the top-left/top-right corners stay rounded through the full hover animation, on both light and dark backgrounds.
