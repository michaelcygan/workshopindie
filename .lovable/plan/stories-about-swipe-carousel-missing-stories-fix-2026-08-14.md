# "Stories about" — swipe carousel + missing stories fix

## What's happening today

The section on your profile lists only blog posts that are **explicitly tagged** to your profile in the post's Connections. Checking the database: there is exactly **one** tag row pointing at your profile (the "King of the Lake" post). The other posts you're thinking of are ones you **wrote** (17+ published), but they carry no profile tag, so the rail can't see them. The rail also caps at 3 items and renders as a static 3-column grid.

So two separate things need to change: how the list is built, and how it's displayed.

## 1. Show the right stories

Broaden the profile rail so it includes both:
- posts tagged to the profile (today's behavior), and
- posts the person authored (creator, listed author, or credited author) that are published and publicly listed.

Deduplicate, sort newest first, and raise the cap for the profile rail from 3 to 12. Other entity rails (Work, Collab, Group, Event) keep their current tag-only behavior.

## 2. Make it a swipe carousel

Replace the fixed grid with a horizontally scrollable, snap-to-card rail:
- Mobile: full-bleed edge-to-edge swipe, ~86vw cards, snap points, hidden scrollbar.
- Desktop: same rail with ~320px cards plus left/right arrow buttons that appear when there's overflow.
- Cards keep the existing editorial look (16:10 cover, date, title, dek, author avatars) and still open the post in the peek overlay.
- Keyboard and screen-reader friendly: the rail is a focusable scroll region, arrows are real buttons with labels.

If there's only one story, it renders as a single card with no arrows.

## Technical notes

- `src/lib/blog-entity-tags.server.ts` → `listBlogPostsForEntityServer`: for `kind === "profile"`, union the tagged post IDs with IDs from `blog_posts.created_by` / `author_profile_id` and `blog_post_authors.profile_id`, keeping the existing `status = published`, `published_at <= now()`, and public-listing filters.
- `src/lib/blog-entity-tags.functions.ts`: raise the `limit` validator max from 6 to 12.
- `src/components/entity-blog-posts.tsx`: add a `layout` prop (`"grid" | "carousel"`, default `grid`) and implement the scroll-snap rail with arrow controls; profile usage in `src/routes/$username.tsx` passes `layout="carousel"` and `limit={12}`.
