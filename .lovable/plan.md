# Make the whole Group card clickable

## What's wrong

On the Groups pages, only the text block of a Group card is a link. The cover photo (the Chicago marquee image, the orange Field panel) sits outside the link, so clicking or tapping the image does nothing — on desktop and on mobile alike. Same story on the standard directory card, where the avatar and header row aren't clickable either.

## The fix

Turn each Group card into a single, fully clickable surface:

- The link stretches over the entire card (image, title, tagline, member row), so a click anywhere opens the Group.
- The Join / Joined button and any other controls stay above the link and keep working as separate buttons — no accidental navigation when tapping Join.
- Hover and keyboard focus highlight the whole card, not just the title.

Applies to both card styles, so every Groups surface behaves the same: the "Where you belong" and "Worth joining" rails, the logged-out Groups home, the full directory grid, and the related-groups grid on a Group page.

## Technical notes

- `src/components/group-featured-card.tsx`: replace the content-only `<Link>` with a stretched-overlay link (`absolute inset-0` anchor inside the `relative` article, with the text content non-interactive underneath); raise `GroupCardActions` with `relative z-10` so it stays clickable.
- `src/components/group-card.tsx`: same pattern — stretched link over the article, `GroupCardActions` and avatar header lifted above it.
- Keep `aria-label={"Open " + group.name}` on the stretched link and move `focus-visible` ring styling to the article via `has-[a:focus-visible]` so keyboard focus is visible.
- No changes to data, queries, or Join behavior.
