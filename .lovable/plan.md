## Goal
On desktop, the standalone stats strip ("8 Gallery, 0 Worked with, 1 Followers, 1 Following") is taking up a full block. Move that data onto the same line as the external-link pills (Instagram, Website, etc.) so the stats occupy the empty space left of the buttons, freeing the vertical space below.

## Changes
All changes are in `src/routes/u.$username.tsx` and are desktop-only; the mobile identity grid and mobile stats strip stay as-is.

1. **Inline the stats into a clickable pill cluster**
   - Create a small `ProfileStats` helper in the route file that renders the four counts as left-justified, rounded pills: `Gallery`, `Worked with`, `Followers`, `Following`.
   - Each pill shows a number bubble plus label and is clickable:
     - `Gallery` → Works tab
     - `Worked with` → About tab
     - `Followers` / `Following` → About tab (placeholder until a dedicated followers list exists)

2. **Merge the external-link pills into the same row**
   - Replace the standalone desktop `LinkPills` block with a combined `hidden md:flex` row that places `ProfileStats` on the left and `LinkPills` on the right tail.
   - Use `flex-wrap` and `justify-between` so the row survives narrower desktop widths without clipping.

3. **Add a desktop-friendly `LinkPills` variant**
   - Add an `variant?: "scroll" | "inline"` prop to the existing `LinkPills` helper (default stays `scroll`).
   - The `inline` variant removes the mobile-only negative margins, snap scrolling, and overflow behavior, rendering the pills as a simple flex wrap.
   - Mobile keeps the existing horizontal scroll.

4. **Remove the desktop stats strip**
   - Delete the separate rounded-2xl stats block that currently sits below the artist statement.
   - Keep the mobile-only stats strip below the portfolio.

## Verification
- Open `/u/michaelcygan` at desktop width.
- Confirm the stats and external-link pills sit on one line directly under the profile meta.
- Confirm the old stats bar below the artist statement is gone.
- Confirm the mobile view still shows the stats strip after the portfolio and the link pills inside the identity grid.
- Run typecheck/build to ensure no errors.