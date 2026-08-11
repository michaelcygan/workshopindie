# Blog posts: hover/tap previews for tagged Workshop items

Right now, when a blog post links to a Work, Collab, Group, Event, another post, or a person, the reader has to leave the article to see what it is. Everywhere else on Workshop those references open a small preview card. This brings that behavior into blog posts.

## What changes

**1. Inline links inside the article body**
Links in the body that point at a Workshop item (`/works/...`, `/collab/...`, `/g/...`, `/g/.../e/...`, `/blog/...`, `/username`) become preview-enabled: on desktop, hovering shows the small preview card; on mobile, tapping opens the preview sheet, with a clear way to continue to the full page. The link keeps looking like a normal editorial link (underlined), so reading flow is unchanged. External links and non-entity internal links behave exactly as today.

**2. "About this post" colophon**
The Works, People, Collabs, Groups, and Events rows get the same previews on hover/tap.

**3. Follow button for tagged people**
The person preview already includes a Follow / Follow back control and mutual-follow state; it now appears wherever a person is referenced in a post. In "About this post", each person row also gets an inline Follow button so a reader can follow without opening the preview. Signed-out readers see the button routed to sign-in, matching the rest of the app.

## Technical notes

- Add a small resolver that maps an internal href to `{ kind, slug, groupSlug }`, reusing the existing entity-kind helpers in `src/lib/entities/kinds.ts` / `parse.ts`.
- In `src/components/blog-post-body.tsx`, the `a` renderer checks that resolver and, on a match, wraps the anchor in the matching peek (`WorkPeek`, `CollabPeek`, `GroupPeek`, `EventPeek`, `BlogPostPeek`, `ProfilePeek`) instead of adding new UI. Peeks that need an id (work, collab, profile) resolve slug → id lazily, only when the preview opens, exactly as `entity-reference-chip.tsx` already does — extract that shared logic so both call sites use one implementation.
- `src/components/blog-post-context.tsx`: wrap `WorkEntry`, `PersonEntry`, `CollabEntry`, `GroupEntry`, `EventEntry` in their peeks; add `FollowButton` to `PersonEntry`.
- No database or schema changes; no changes to how tags are stored or authored.
