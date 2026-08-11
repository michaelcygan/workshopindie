# Fix: blog mini preview for TWENTY-DOLLAR SMOOTHIE

## What I found

The link in "What self-publishing makes possible" points at `/works/twenty-dollar-smoothie-...`, that Work exists and is public, and the lookup succeeds for logged-out visitors.

On the preview build the link correctly opens the Work preview dialog. On the published site (workshopindie.com) the same click does a full page navigation to the Work page instead. I checked the live JavaScript bundles for that page: none of them contain the preview code. The published deployment predates the inline preview feature — the code is correct, the live site is just running an older build.

## Plan

1. Republish the site so the current build (with inline entity previews) goes live, then re-verify the link on workshopindie.com.
2. Polish pass on the Work preview dialog while we're here, since the cover art currently dominates the popup on desktop:
   - Cap the cover height so the title, description, author and stats are visible without scrolling.
   - Keep the "Open full piece" action anchored at the bottom.
3. Small a11y cleanup: the peek dialogs log a missing `Description`/`aria-describedby` warning — add a description or `aria-describedby={undefined}` where appropriate.

## Technical notes

- No database or permissions change is needed; anon `SELECT` on `works` by slug already returns the row.
- Files touched for step 2/3: `src/components/work-peek.tsx` (cover sizing, dialog description). `src/components/entity/entity-link-preview.tsx` and `src/lib/entities/href.ts` stay as-is.
