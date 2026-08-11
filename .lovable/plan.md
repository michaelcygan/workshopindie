# Hover glance for tagged Works and Collabs in blog posts

## What's happening

The circled link is a tagged Work, and it is wired up correctly — but by design it only responds to a **click**, which opens the full preview dialog. There is no hover behavior attached to it at all, so nothing appears on hover.

Group, Event and Person links in the same prose already behave the way you expect: hover on desktop shows a small card, tap on mobile opens a drawer. Work, Collab and Blog-post links were built on the click-to-dialog path instead, so they're the odd ones out.

## The fix

Give Work, Collab and Blog-post links the same two-speed behavior as the others:

- **Desktop hover** — a compact glance card appears after a short delay: cover thumbnail, title, category, one-line excerpt, and light stats. Data loads only on first hover, so a post full of tags stays cheap.
- **Click** — still opens the existing full preview dialog, unchanged. Cmd/Ctrl-click still opens the real page in a new tab.
- **Mobile / touch** — tap still opens the full preview; no hover card (there is no hover on touch).
- Keyboard focus arms the same glance card, so it isn't mouse-only.

Visually the glance card matches the existing Group peek: same width, radius, and card treatment, so prose links all feel like one system.

## Technical notes

- Add a shared `EntityGlance` hover-card wrapper in `src/components/entity/entity-link-preview.tsx`, reusing `HoverCard` from the UI kit and `useIsMobile` — the same combination `GroupPeek` uses.
- `SlugDialogPreview` and `PostLinkPreview` wrap their trigger anchor in that hover card on desktop, keeping the current `onClick` → dialog logic intact.
- Hover arms `useEntityIdBySlug`, then the glance body reads the existing `work-peek` / collab peek query data — the same query keys the dialog uses, so opening the dialog after a hover is instant and costs no extra request.
- Add a small summary fetch for blog-post links (title, excerpt, cover) rather than loading the full post body on hover.

## Note on production

This behavior change needs a publish to appear on workshopindie.com; the preview will show it immediately.
