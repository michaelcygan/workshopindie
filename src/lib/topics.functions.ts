import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isBlogFeedTab, type BlogFeedTab } from "@/lib/blog-feed.server";

const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=600";

const feedInput = z.object({
  tab: z.string().default("latest"),
  topic: z.string().max(80).nullish(),
  medium: z.string().max(60).nullish(),
  postType: z.string().max(40).nullish(),
  section: z.string().max(40).nullish(),
  cursor: z.object({ published_at: z.string(), id: z.string() }).nullish(),
  limit: z.number().int().min(1).max(24).optional(),
});

function normalizeTab(value: string): BlogFeedTab {
  return isBlogFeedTab(value) ? value : "latest";
}

/** Public feed: Latest, Featured, Topic and Medium hubs. */
export const blogFeed = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => feedInput.parse(d))
  .handler(async ({ data }) => {
    const { listBlogFeedServer } = await import("./blog-feed.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    return listBlogFeedServer({
      ...data,
      tab: normalizeTab(data.tab),
      cursor: data.cursor ?? null,
    });
  });

/** Personalized feed: For You and Following. Requires a session. */
export const blogFeedPersonal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => feedInput.parse(d))
  .handler(async ({ data, context }) => {
    const { listBlogFeedServer } = await import("./blog-feed.server");
    const { myFollowsServer } = await import("./topics/topics.server");
    const follows = await myFollowsServer(context.supabase, context.userId);

    const { data: followRows } = await context.supabase
      .from("follows")
      .select("followed_user_id")
      .eq("follower_user_id", context.userId)
      .limit(500);

    return listBlogFeedServer(
      { ...data, tab: normalizeTab(data.tab), cursor: data.cursor ?? null },
      {
        userId: context.userId,
        topicIds: follows.topicIds,
        fieldIds: follows.fieldIds,
        authorProfileIds: ((followRows ?? []) as Array<{ followed_user_id: string }>).map(
          (r) => r.followed_user_id,
        ),
      },
    );
  });

export const searchTopics = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().max(80).default(""), limit: z.number().int().min(1).max(50).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { searchTopicsServer } = await import("./topics/topics.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    return searchTopicsServer(data.q, data.limit ?? 20);
  });

export const listTrendingTopics = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { trendingTopicsServer } = await import("./topics/topics.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    return trendingTopicsServer(data.limit ?? 24);
  });

export const getTopicHub = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { getTopicBySlugServer } = await import("./topics/topics.server");
    const { listBlogFeedServer } = await import("./blog-feed.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const topic = await getTopicBySlugServer(data.slug);
    if (!topic) return { topic: null, posts: [], nextCursor: null };
    const feed = await listBlogFeedServer({ tab: "latest", topic: topic.slug, limit: 24 });
    return { topic, posts: feed.posts, nextCursor: feed.nextCursor };
  });

export const getMediumHub = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { getMediumBySlugServer } = await import("./topics/topics.server");
    const { listBlogFeedServer } = await import("./blog-feed.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const medium = await getMediumBySlugServer(data.slug);
    if (!medium) return { medium: null, posts: [], nextCursor: null };
    const feed = await listBlogFeedServer({ tab: "latest", medium: medium.field_id, limit: 24 });
    return { medium, posts: feed.posts, nextCursor: feed.nextCursor };
  });

export const listMediums = createServerFn({ method: "GET" }).handler(async () => {
  const { listMediumsServer } = await import("./topics/topics.server");
  setResponseHeader("cache-control", PUBLIC_CACHE);
  return listMediumsServer();
});

export const myTopicFollows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { myFollowsServer } = await import("./topics/topics.server");
    return myFollowsServer(context.supabase, context.userId);
  });

export const toggleTopicFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topicId: z.string().uuid(), follow: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { toggleTopicFollowServer } = await import("./topics/topics.server");
    return toggleTopicFollowServer(context.supabase, context.userId, data.topicId, data.follow);
  });

export const toggleMediumFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ fieldId: z.string().min(1).max(60), follow: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { toggleMediumFollowServer } = await import("./topics/topics.server");
    return toggleMediumFollowServer(context.supabase, context.userId, data.fieldId, data.follow);
  });

/** Replace the Topics attached to a Blog post the caller can edit. */
export const setBlogPostTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ postId: z.string().uuid(), names: z.array(z.string().max(60)).max(10) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setEntityTopicsServer } = await import("./topics/topics.server");
    return setEntityTopicsServer(
      context.supabase,
      "post",
      data.postId,
      data.names,
      context.userId,
    );
  });
