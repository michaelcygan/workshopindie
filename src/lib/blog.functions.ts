import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPublishedPosts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { blogPublicCacheHeader, listPublishedPostsServer } = await import("./blog.server");
    setResponseHeader("cache-control", blogPublicCacheHeader());
    return listPublishedPostsServer();
  });

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { blogPublicCacheHeader, getPublishedPostServer } = await import("./blog.server");
    setResponseHeader("cache-control", blogPublicCacheHeader());
    return getPublishedPostServer(data.slug);
  });

export const getRelatedPosts = createServerFn({ method: "GET" })
  .inputValidator((d: { excludeId: string; limit?: number }) =>
    z.object({ excludeId: z.string().uuid(), limit: z.number().int().min(1).max(6).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { blogPublicCacheHeader, getRelatedPostsServer } = await import("./blog.server");
    setResponseHeader("cache-control", blogPublicCacheHeader());
    return getRelatedPostsServer(data.excludeId, data.limit ?? 3);
  });

export const listProfileBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({
      profileId: z.string().uuid(),
      cursor: z
        .object({
          published_at: z.string().min(1),
          id: z.string().uuid(),
        })
        .nullable()
        .optional(),
      limit: z.number().int().min(1).max(24).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { blogPublicCacheHeader, listProfileBlogPostsServer } = await import("./blog.server");
    setResponseHeader("cache-control", blogPublicCacheHeader());
    return listProfileBlogPostsServer(data.profileId, data.cursor ?? null, data.limit ?? 12);
  });

export const adminSearchAuthorProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminSearchAuthorProfilesServer } = await import("./blog.server");
    return adminSearchAuthorProfilesServer(context, data.q);
  });

export const adminSetPostAuthors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      post_id: z.string().uuid(),
      authors: z.array(
        z.object({
          profile_id: z.string().uuid(),
          role_label: z.string().trim().max(60).nullable().optional(),
        }),
      ).max(20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adminSetPostAuthorsServer } = await import("./blog.server");
    return adminSetPostAuthorsServer(context, data.post_id, data.authors);
  });


export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminListPostsServer } = await import("./blog.server");
    return adminListPostsServer(context);
  });

export const adminListAuthorProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminListAuthorProfilesServer } = await import("./blog.server");
    return adminListAuthorProfilesServer(context);
  });

export const adminGetPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminGetPostServer } = await import("./blog.server");
    return adminGetPostServer(context, data.id);
  });

export const adminCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
    excerpt: z.string().trim().max(320).default(""),
    body_markdown: z.string().max(200_000).default(""),
    cover_image_url: z.string().trim().url().max(1000).nullable().optional(),
    cover_image_alt: z.string().trim().max(240).nullable().optional(),
    seo_title: z.string().trim().max(80).nullable().optional(),
    seo_description: z.string().trim().max(160).nullable().optional(),
    author_name: z.string().trim().min(1).max(120).default("Workshop"),
    author_profile_username: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminCreateDraftServer } = await import("./blog.server");
    return adminCreateDraftServer(context, data);
  });

export const adminUpdatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/).optional(),
    excerpt: z.string().trim().max(320).default(""),
    body_markdown: z.string().max(200_000).default(""),
    cover_image_url: z.string().trim().url().max(1000).nullable().optional(),
    cover_image_alt: z.string().trim().max(240).nullable().optional(),
    seo_title: z.string().trim().max(80).nullable().optional(),
    seo_description: z.string().trim().max(160).nullable().optional(),
    author_name: z.string().trim().min(1).max(120).default("Workshop"),
    author_profile_username: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminUpdatePostServer } = await import("./blog.server");
    return adminUpdatePostServer(context, data);
  });

export const adminPublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminPublishPostServer } = await import("./blog.server");
    return adminPublishPostServer(context, data.id);
  });

export const adminUnpublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminUnpublishPostServer } = await import("./blog.server");
    return adminUnpublishPostServer(context, data.id);
  });

export const adminDeleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminDeleteDraftServer } = await import("./blog.server");
    return adminDeleteDraftServer(context, data.id);
  });
