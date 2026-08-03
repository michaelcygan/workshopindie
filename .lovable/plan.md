## What's wrong

Your post is published, but it's hidden from `/blog` by data, not caching. The member publish path creates posts with `show_in_blog_index = false` (verified: your "How to use plugins in GarageBand" post is `status: published`, `publication_type: member`, `show_in_blog_index: false`), and the blog index query filters on `show_in_blog_index = true`. So `/blog` is currently editorial-only. The list itself is live (server-loaded on each request, 60s edge cache), it just never included member posts.

## Wave 1 — Member posts on the Blog page

- Default new member posts to visible in the index instead of hidden, and backfill existing published member posts to visible.
- Add a **"List on the public Blog page"** switch in the member editor's **Details** tab (on by default). Turning it off keeps the post live at its URL but out of `/blog`, RSS, and the sitemap — same behavior admins already have.
- One feed, reverse chronological, mixing editorial and member posts. Each card gets an author byline (avatar + name, linking to the profile) so the two sources read clearly without splitting the page.

## Wave 2 — Featured slot

- Add an admin-only `featured` flag on posts.
- If a post is featured, it renders as the hero at the top and is removed from the list below.
- If nothing is featured, the page drops the hero entirely and goes straight to a reverse-chronological feed — no oversized lead card.

## Wave 3 — Mobile density pass

Current mobile problems: the page header eats a full screen, the hero image is a 4:3 block, and the first card's snippet falls below the fold.

- Tighten the masthead: smaller eyebrow, `text-3xl` title, description clamped to 2 lines on mobile with full text from `sm:` up.
- Hero (when featured): 16:10 image, overlay title/date on the image, one-line excerpt underneath.
- Feed cards on mobile become horizontal rows — square thumbnail on the left, date / title / 2-line snippet on the right — so 3–4 posts are visible per screen instead of one. Desktop keeps the existing 2–3 column card grid.
- Add author avatar + reading date to each row; keep tap targets at 44px and the whole row tappable.
- Bottom padding so the mobile action island never covers the last card.

## Technical notes

- Migration: `alter table blog_posts add column featured boolean not null default false`; index on `(featured, published_at desc)`; backfill `show_in_blog_index = true` for published member posts (data update via the insert tool, not the migration).
- Member publish path in `src/lib/blog-member.server.ts` stops forcing `show_in_blog_index = false`; new field accepted by the member update validator in `blog-member.functions.ts`.
- `listPublishedPostsServer` in `src/lib/blog.server.ts` selects `featured`, `publication_type`, and joins the author profile (username/display_name/avatar_url) for bylines.
- `src/routes/blog.index.tsx` splits into a `FeaturedHero` and a `PostRow`/`PostCard` pair; JSON-LD and head metadata stay as-is.
- Moderation and RLS unchanged — member posts already pass through `moderateFields` on write.
