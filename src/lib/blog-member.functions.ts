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
import { BLOG_SEED_PROMPT_IDS } from "@/lib/blog-seed-prompts";
import { BLOG_CATEGORY_SLUGS } from "@/lib/blog-categories";
import { FIELD_IDS } from "@/lib/taxonomy";
import { BLOG_STORY_TYPE_IDS, MAX_BLOG_SUBJECTS } from "@/lib/blog-story-types";

const cursorSchema = z.object({ updated_at: z.string(), id: z.string().uuid() }).nullable();

export const getMyBlogAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => getMyBlogAccessServer(context));

export const listMyBlogPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cursor: cursorSchema.default(null),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input),
  )
  .handler(({ context, data }) => listMyBlogPostsServer(context, data.cursor, data.limit));

export const createMyBlogDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        seedTag: z
          .object({
            kind: z.enum(["work", "collab", "group", "event", "profile"]),
            id: z.string().uuid(),
          })
          .optional(),
        seedPromptId: z.enum(BLOG_SEED_PROMPT_IDS).optional(),
      })
      .optional()
      .parse(input ?? {}),
  )
  .handler(({ context, data }) =>
    createMyBlogDraftServer(context, data?.seedTag, data?.seedPromptId),
  );

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
        show_in_blog_index: z.boolean().optional(),
        category_slug: z.enum(BLOG_CATEGORY_SLUGS).optional(),
        fields: z.array(z.enum(FIELD_IDS)).max(3).optional(),
        subcategories: z.array(z.string().max(80)).max(1).optional(),
        story_type: z.enum(BLOG_STORY_TYPE_IDS).nullable().optional(),
        story_types: z.array(z.enum(BLOG_STORY_TYPE_IDS)).max(3).optional(),
        subjects: z.array(z.string().max(80)).max(MAX_BLOG_SUBJECTS).optional(),
        tags: z
          .array(
            z.object({
              kind: z.enum(["work", "collab", "group", "event", "profile", "post"]),
              id: z.string().uuid(),
            }),
          )
          .max(20)
          .optional(),
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
