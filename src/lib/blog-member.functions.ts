import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getMyBlogAccessServer,
  listMyBlogPostsServer,
  createMyBlogDraftServer,
  getMyBlogPostServer,
  updateMyBlogPostServer,
  publishMyBlogPostServer,
  unpublishMyBlogPostServer,
  deleteMyBlogDraftServer,
} from "@/lib/blog-member.server";

const cursorSchema = z
  .object({ updated_at: z.string(), id: z.string().uuid() })
  .nullable();

export const getMyBlogAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getMyBlogAccessServer(context));

export const listMyBlogPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ cursor: cursorSchema.default(null), limit: z.number().int().min(1).max(50).default(20) }).parse(input),
  )
  .handler(({ context, data }) => listMyBlogPostsServer(context, data.cursor, data.limit));

export const createMyBlogDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => createMyBlogDraftServer(context));

export const getMyBlogPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(({ context, data }) => getMyBlogPostServer(context, data.id));

export const updateMyBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(200).optional(),
        slug: z.string().max(140).optional(),
        excerpt: z.string().max(400).optional(),
        body_markdown: z.string().max(50_000).optional(),
        cover_image_url: z.string().url().nullable().optional(),
        cover_image_alt: z.string().max(300).nullable().optional(),
        seo_title: z.string().max(120).nullable().optional(),
        seo_description: z.string().max(240).nullable().optional(),
        expected_updated_at: z.string().optional(),
      })
      .parse(input),
  )
  .handler(({ context, data }) => {
    const { id, ...rest } = data;
    return updateMyBlogPostServer(context, id, rest);
  });

export const publishMyBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(({ context, data }) => publishMyBlogPostServer(context, data.id));

export const unpublishMyBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(({ context, data }) => unpublishMyBlogPostServer(context, data.id));

export const deleteMyBlogDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(({ context, data }) => deleteMyBlogDraftServer(context, data.id));
