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
  limit: z.number().int().min(1).max(60).optional(),
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
    const { resolveTopicSlug } = await import("./topics/search.server");
    const { topicHubEntities } = await import("./topics/hub.server");
    const { listBlogFeedServer } = await import("./blog-feed.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);

    const resolved = await resolveTopicSlug(data.slug);
    if (!resolved) {
      return {
        topic: null,
        canonicalSlug: null,
        posts: [],
        nextCursor: null,
        entities: { works: [], collabs: [], events: [], groups: [] },
      };
    }

    const topic = resolved.topic;
    const [feed, entities] = await Promise.all([
      listBlogFeedServer({ tab: "latest", topic: topic.slug, limit: 24 }),
      topicHubEntities(topic.id, 12),
    ]);
    return {
      topic,
      canonicalSlug: resolved.canonicalSlug,
      posts: feed.posts,
      nextCursor: feed.nextCursor,
      entities,
    };
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

/* -------------------------------------------------------------------------- */
/* Canonical Topic picker contract                                            */
/* -------------------------------------------------------------------------- */

/** Ranked search across canonical preferred labels and aliases. */
export const topicSearch = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ q: z.string().max(80).default(""), limit: z.number().int().min(1).max(30).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { searchCanonicalTopics } = await import("./topics/search.server");
    setResponseHeader("cache-control", "public, s-maxage=30, stale-while-revalidate=300");
    const { topics, exactMatch } = await searchCanonicalTopics(data.q, data.limit ?? 12);
    return { topics, exactMatchId: exactMatch?.id ?? null };
  });

/** Hydrate selected Topics by id (for edit forms). */
export const topicsByIdList = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { topicsByIds } = await import("./topics/search.server");
    return topicsByIds(data.ids);
  });

/** Member-created canonical Topic. Rate limited; races collapse onto one row. */
export const createTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ label: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { createCanonicalTopic } = await import("./topics/search.server");
    const { data: allowed } = await context.supabase.rpc("check_and_bump", {
      _action: "topic_create",
      _key: context.userId,
      _window_s: 86400,
      _max: 10,
    });
    if (allowed === false) {
      throw new Error("You've added a lot of new topics today. Try again tomorrow.");
    }

    const { moderateOrThrow } = await import("@/lib/moderation/service.server");
    await moderateOrThrow({
      userId: context.userId,
      surface: "topic.create",
      text: data.label,
      strict: true,
    });

    return createCanonicalTopic(context.supabase, data.label, context.userId);
  });

const ENTITY_KIND = z.enum(["post", "work", "group", "collab", "event", "resource"]);

/** Replace the Topics attached to any entity the caller can edit (RLS decides). */
export const setEntityTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: ENTITY_KIND,
        entityId: z.string().uuid(),
        topicIds: z.array(z.string().uuid()).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setEntityTopicIdsServer } = await import("./topics/topics.server");
    const max = data.kind === "collab" || data.kind === "event" ? 3 : 5;
    return setEntityTopicIdsServer(context.supabase, data.kind, data.entityId, data.topicIds, max);
  });

/** Topics attached to a batch of entities of one kind, keyed by entity id. */
export const entityTopics = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ kind: ENTITY_KIND, ids: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { topicsForEntitiesServer } = await import("./topics/topics.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const map = await topicsForEntitiesServer(data.kind, data.ids);
    return Object.fromEntries(map);
  });

/** Canonical Topics currently in use for one entity kind — filter options. */
export const listTopicsInUse = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ kind: ENTITY_KIND, limit: z.number().int().min(1).max(60).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { topicsInUseServer } = await import("./topics/topics.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    return topicsInUseServer(data.kind, data.limit ?? 40);
  });

/** Entity ids of one kind carrying a Topic slug — used to narrow filtered feeds. */
export const topicEntityIds = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ kind: ENTITY_KIND, slug: z.string().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { getTopicBySlugServer, entityIdsForTopicServer } = await import("./topics/topics.server");
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const topic = await getTopicBySlugServer(data.slug);
    if (!topic) return { topicId: null as string | null, ids: [] as string[] };
    return { topicId: topic.id, ids: await entityIdsForTopicServer(data.kind, topic.id, 500) };
  });
