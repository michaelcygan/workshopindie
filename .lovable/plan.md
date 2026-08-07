# Author actions on a blog post page

Add "Edit post" and "My posts" buttons to the byline row of a published blog post, visible only to the person who owns that post.

## Behaviour

- **Edit post** — primary-ish outline button, opens that post directly in the Workshop blog editor (`/me/blog/<id>`).
- **My posts** — secondary button next to it, opens the member's blog dashboard (`/me/blog`).
- Both render only when the signed-in viewer owns the post (the post's owner id matches the viewer). Everyone else — including other signed-in members and logged-out visitors — sees the byline exactly as it is today.
- Placed inline at the end of the "By Michael Cygan · August 7, 2026" line (the circled spot), wrapping below on narrow screens.

```text
GAMES & TECH
A case for universal access to artificial intelligence
As the real cost of ...

By Michael Cygan · August 7, 2026    [ Edit post ]  [ My posts ]
```

## Technical notes

- `getPublishedPostServer` in `src/lib/blog.server.ts` currently does not select the owner column; add `created_by` (and `author_profile_id`) to that select so the page can decide ownership. No new query, no RLS change.
- New small client component `src/components/blog/blog-author-actions.tsx`: reads `useAuth()`, returns `null` unless `user.id === createdBy`, renders the two buttons using the existing pill/outline button styles already used by `blog-masthead-actions.tsx`.
- Render it from the byline `<div>` in `src/routes/blog.$slug.tsx`.
- Ownership check is presentational only — the editor route already enforces access server-side.
