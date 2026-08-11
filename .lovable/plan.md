# Move "More from the blog" above Comments

On a blog post the order today is: article body → share row → **Comments** → "Make something with people." CTA + newsletter → **More from the blog**.

New order: article body → share row → **More from the blog** → **Comments** → CTA + newsletter.

## Changes

- `src/components/blog-article-footer.tsx`: add an optional `section` prop (`"related" | "cta" | "both"`, default `"both"`) so the related-posts grid and the CTA/newsletter block can be rendered separately. No visual change to either block.
- `src/routes/blog.$slug.tsx`: render `<BlogArticleFooter section="related" />` right after the share row, then `<BlogComments />`, then `<BlogArticleFooter section="cta" />`.

The blog peek dialog keeps using the default `"both"` behavior, so it is unchanged.
