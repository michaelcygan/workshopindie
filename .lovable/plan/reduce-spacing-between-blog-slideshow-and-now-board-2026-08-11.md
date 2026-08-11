# Reduce spacing between blog slideshow and Now board

Adjust the vertical padding between the "Featured from the Blog" slideshow and the "Now" board on the logged-in member homepage so the gap is smaller and better proportioned.

## Changes

- In `src/components/home/home-featured-blog.tsx`, reduce the header's bottom padding (`pb-4`) slightly.
- In `src/components/home/member-home.tsx`, reduce the top padding on the `NowBoardDesktop` wrapper (`pt-6`) slightly and, if present, trim any extra top padding on the `NowBoardMobile` wrapper (`HomeSection`) to match.

## Verification

- Open the logged-in homepage preview.
- Confirm the circled gap between the blog card and the Now board is visibly tighter and the two modules feel balanced.
- Check both desktop and mobile breakpoints.
