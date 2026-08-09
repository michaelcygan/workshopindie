# Remove the excerpt block from the blog post template

## Goal
Stop rendering the post excerpt between the title and the byline on the public blog post page. The excerpt is still used for SEO meta descriptions and schema markup, but the circled body copy should no longer appear in the article header.

## Changes
1. In `src/routes/blog.$slug.tsx`, remove the excerpt paragraph block:
   ```tsx
   {post.excerpt && (
     <p className="mt-4 text-lg text-ink-soft">{post.excerpt}</p>
   )}
   ```
   Keep the title and byline spacing intact.
2. Preserve SEO usage of `excerpt` in `head()` (meta description, JSON-LD `description`).

## Verification
- Open a published blog post that currently shows an excerpt.
- Confirm the excerpt text is no longer rendered between the title and the byline.
- Confirm the page title, meta description, and share image metadata are unchanged.
