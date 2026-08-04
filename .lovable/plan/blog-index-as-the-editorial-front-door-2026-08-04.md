# Blog index as the editorial front door

Restyle `/blog` so it reads like the logged-out homepage — same masthead, same editorial rhythm — but populated only with blog posts. Signed-in members get the publication view they'd otherwise miss.

## What changes

The current `/blog` is a heading plus a uniform card grid (with a featured hero/carousel on top). It gets replaced by the same section language the public homepage uses:

```text
MASTHEAD          Blog · "Notes from Workshop" + standfirst, hairline rule under
FEATURED STORY    one large 16:10 lead + two compact thumbnail rows beside it
THE BLOG          "Latest stories" — big lead story + right-hand list of 5
MORE FROM THE BLOG  "Keep reading" — denser grid of the next posts
ARCHIVE           remaining posts as a compact list, so nothing is dropped
```

Everything is full-bleed `max-w-7xl` with hairline `border-b` dividers between bands, matching the homepage — not the current narrower `max-w-6xl` boxed-card layout.

## Behavior

- Post ordering: admin-featured posts lead, topped up with the newest posts so the featured block always has three, exactly like the homepage does.
- No post appears twice — each band consumes from the remaining pool.
- Everything below the first three bands is whatever is left, in reverse-chronological order, so long archives still render.
- Mobile: the homepage sections already collapse to single-column stacks; the blog page inherits that. The current mobile-only dense `PostRow` list is kept for the archive tail so long lists stay scannable on phones.
- Empty state ("Nothing published yet") is preserved.
- Route metadata, canonical URL, and the `Blog` JSON-LD block are untouched.
- This is the same page for signed-out and signed-in visitors — no auth branching.

## Technical notes

Files touched:
- `src/routes/blog.index.tsx` — rewrite the component body; keep loader, `head()`, and JSON-LD as-is.
- New `src/components/blog/blog-editorial-sections.tsx` — the blog-only variants of the featured / latest / more bands, plus the archive list.

`PublicFeaturedStories` and `PublicLatestStories` take `PublicBlogCard`, while the blog loader returns `BlogListItem` (snake_case: `cover_image_url`, `published_at`, author object). A small `toBlogCard()` adapter in the new file maps `BlogListItem` → `PublicBlogCard` so the existing homepage components are reused verbatim rather than duplicated — no visual drift between the two pages. Only the archive band is new markup.

`FeaturedHero` / `BlogFeaturedCarousel` are no longer used by this route; they stay in place for other consumers.
