import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_BLOG_ENTITY_TAGS } from "@/lib/blog-entity-tags";

const kindSchema = z.enum(["work", "collab", "group", "event", "profile"]);

const tagsInput = z
  .array(z.object({ kind: kindSchema, id: z.string().uuid() }))
  .max(MAX_BLOG_ENTITY_TAGS);

export const getBlogPostEntityTagsPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { getBlogPostEntityTagsServer } = await import("./blog-entity-tags.server");
    setResponseHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=600");
    return getBlogPostEntityTagsServer(data.postId, { publicOnly: true });
  });

export const getBlogPostEntityTagsForOwner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getBlogPostEntityTagsServer } = await import("./blog-entity-tags.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("blog_posts").select("created_by").eq("id", data.postId).maybeSingle();
    if (!p) throw new Error("Post not found.");
    const isOwner = p.created_by === context.userId;
    if (!isOwner) {
      const { data: isAdmin } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
      if (!isAdmin) throw new Error("Forbidden.");
    }
    return getBlogPostEntityTagsServer(data.postId, { publicOnly: false });
  });

export const setBlogPostEntityTagsForMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ postId: z.string().uuid(), tags: tagsInput }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setBlogPostEntityTagsForOwnerServer } = await import("./blog-entity-tags.server");
    return setBlogPostEntityTagsForOwnerServer(data.postId, context.userId, data.tags);
  });

export const setBlogPostEntityTagsForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ postId: z.string().uuid(), tags: tagsInput }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setBlogPostEntityTagsForAdminServer } = await import("./blog-entity-tags.server");
    return setBlogPostEntityTagsForAdminServer({ userId: context.userId }, data.postId, data.tags);
  });

export const listBlogPostsForEntity = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ kind: kindSchema, entityId: z.string().uuid(), limit: z.number().int().min(1).max(6).optional() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { listBlogPostsForEntityServer } = await import("./blog-entity-tags.server");
    setResponseHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=600");
    return listBlogPostsForEntityServer(data.kind, data.entityId, data.limit ?? 3);
  });
