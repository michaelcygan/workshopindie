Refine the Ken Burns slideshow on the profile medium tiles so the transitions feel elegant rather than synchronized.

What we change
- Pass the tile's row index into `CategoryTileMedia` so each row can have its own staggered animation phase.
- Increase the slide interval from 5s to 8s, and the crossfade duration from 700ms to 1200ms.
- Offset the Ken Burns drift and the slideshow start time per row by roughly 1.5s per row, so Film, Music, Book, etc. never all transition together.
- Keep the existing `prefers-reduced-motion` guard and visibility-pause behavior.

Where the changes go
- `src/routes/u.$username.tsx` — update `CategoryTileMedia` to accept `index`, derive the staggered start, and wire it into the medium tile loop.
- `src/styles.css` — keep `@keyframes kenburns`; optionally add a staggered delay helper if needed, but prefer in-component offsets for clarity.

Why this approach
- The request is purely visual/timing; no data or API changes are needed.
- In-component offsets are easier to tune than multiple CSS utilities and keep the effect tied to the actual tile count.

Verification
- Preview a profile on mobile and desktop to confirm tiles fade at different moments, and that the motion still pauses with reduced motion and on hidden tabs.