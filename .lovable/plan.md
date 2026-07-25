## What's happening

On `/me/blog`, only the post **title text** is a link to the editor. The rest of the row (thumbnail, excerpt area, and the empty right side you circled) isn't clickable, so tapping anywhere but the small "Untitled" text does nothing. For drafts, the "View" pill on the right is intentionally hidden (it only appears for published posts), which is why that area looks empty.

No three-dot menu is needed to open a draft — the row itself should just open the editor.

## Fix

Edit `src/routes/me.blog.index.tsx` only:

1. Make each `<li>` a full-row link to `/me/blog/$id` (wrap the row contents in a `Link`, or use `useNavigate` on row click) so tapping the thumbnail, title, excerpt, or empty right area all open the editor.
2. Replace the inner title `<Link>` with a plain heading (avoids nested anchors) but keep the same visual style and hover underline on the title.
3. For published posts, keep a distinct "View" affordance that stops event propagation so it opens the public post instead of the editor.
4. Add a subtle right-side chevron (`ChevronRight`) as a visual affordance in the spot you circled, so it's clear the row is tappable — for both drafts and published posts.

No backend, schema, or access-logic changes.
