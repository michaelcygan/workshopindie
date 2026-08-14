/**
 * Shared renderer for Workshop's Markdown-light bodies.
 *
 * `BlogPostBody` is the original implementation and stays the canonical one;
 * `RichBody` is the neutral name used outside the Blog (Work descriptions,
 * anywhere else that stores the same segment format).
 */
export { BlogPostBody as RichBody } from "@/components/blog-post-body";
