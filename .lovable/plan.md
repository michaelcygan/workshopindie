Refine the mobile profile tile Ken Burns slideshow timing so the row-to-row cadence is more elegantly varied.

What we change
- Increase the base transition offset between rows from 1.5s to 3s per row.
- Add a stable per-row variance of up to 3s, derived from the category id so the same category always behaves the same and the pattern doesn't look mechanical.
- Apply the same variance idea to the Ken Burns animation phase so each row's drift is also uniquely offset.
- Keep the existing 8s slide interval and 1.2s crossfade; only the stagger spacing changes.

Where the changes go
- `src/routes/u.$username.tsx` — pass the category id to `CategoryTileMedia` and compute the final delay as `index * 3000ms + stableVariance(categoryId, 0–3000ms)`.
- `src/styles.css` — no changes needed; the existing `animate-kenburns` utility is used with inline `animationDelay`.

Why this approach
- The variance is tied to the category id so it is stable across re-renders and doesn't feel random or jittery.
- The base 3s per row gives clear separation, while the extra 0–3s variance makes the timing feel organic.

Verification
- Preview the mobile profile and observe that the Film, Music, Book tiles transition at clearly different, non-uniform moments over 20–30s.