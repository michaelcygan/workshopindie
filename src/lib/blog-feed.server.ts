/**
 * Server-backed Blog feed.
 *
 * Four tabs — For You, Following, Featured, Latest — over the same query
 * surface, plus scalable filters (Topic, Medium, Post type). Filtering and
 * ordering happen in Postgres; the browser never loads the whole Blog to
 * narrow it down.
 */
import { BLOG_CARD_COLUMNS_WITH_AUTHOR } from "@/lib/blog-select";
import { storyTypesForSection } from "@/lib/blog-story-types";
import {
  entityIdsForTopicServer,
  getTopicBySlugServer,
  topicsForEntitiesServer,
  topicsPublicClient,
} from "@/lib/topics/topics.server";
import type { Topic } from "@/lib/topics/topics";

export const BLOG_FEED_TABS = ["for-you", "following", "featured", "latest"] as const;
export type BlogFeedTab = (typeof BLOG_FEED_TABS)[number];

export type BlogFeedCursor = { published_at: string; id: string } | null;

export type BlogFeedViewer = {
  userId: string;
  topicIds: string[];
  fieldIds: string[];
  authorProfileIds: string[];
} | null;

export type BlogFeedInput = {
  tab: BlogFeedTab;
  topic?: string | null;
  medium?: string | null;
  postType?: string | null;
  section?: string | null;
  cursor?: BlogFeedCursor;
  limit?: number;
};

export type BlogFeedRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string | null;
  published_at: string | null;
  updated_at?: string | null;
  featured?: boolean | null;
  publication_type?: string | null;
  category_slug?: string | null;
  fields?: string[] | null;
  subjects?: string[] | null;
  story_type?: string | null;
  story_types?: string[] | null;
  author_profile?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  topics?: Topic[];
};

export type BlogFeedResult = {
  posts: BlogFeedRow[];
  nextCursor: BlogFeedCursor;
  tab: BlogFeedTab;
  /** Resolved Topic when the feed is filtered by one. */
  topic: Topic | null;
};

const MAX_LIMIT = 60;

export function isBlogFeedTab(value: unknown): value is BlogFeedTab {
  return typeof value === "string" && (BLOG_FEED_TABS as readonly string[]).includes(value);
}

/**
 * `for-you` and `following` require a viewer. Without one they degrade to the
 * public equivalents rather than returning an empty feed.
 */
export function resolveFeedTab(tab: BlogFeedTab, viewer: BlogFeedViewer): BlogFeedTab {
  if (!viewer && (tab === "for-you" || tab === "following")) return "latest";
  return tab;
}

export async function listBlogFeedServer(
  input: BlogFeedInput,
  viewer: BlogFeedViewer = null,
): Promise<BlogFeedResult> {
  const limit = Math.min(Math.max(input.limit ?? 12, 1), MAX_LIMIT);
  const tab = resolveFeedTab(input.tab, viewer);
  const client = topicsPublicClient();

  const topic = input.topic ? await getTopicBySlugServer(input.topic) : null;

  // Topic filters resolve to a post-id set before the main query so the feed
  // keeps a single ordering path.
  let restrictIds: string[] | null = null;
  if (input.topic) {
    restrictIds = topic ? await entityIdsForTopicServer("post", topic.id, 1000) : [];
  }

  if (tab === "following" && viewer) {
    const followedPostIds = await followedPostIdsServer(viewer);
    restrictIds = restrictIds ? intersect(restrictIds, followedPostIds) : followedPostIds;
  }

  if (restrictIds && restrictIds.length === 0) {
    return { posts: [], nextCursor: null, tab, topic };
  }

  // For You ranks a recent candidate pool; the other tabs page by recency.
  const fetchLimit = tab === "for-you" ? 120 : limit + 1;

  let qb = client
    .from("blog_posts")
    .select(BLOG_CARD_COLUMNS_WITH_AUTHOR)
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(fetchLimit);

  if (restrictIds) qb = qb.in("id", restrictIds.slice(0, 1000));
  if (tab === "featured") qb = qb.eq("featured", true);

  const fieldId = input.medium?.trim();
  if (fieldId) qb = qb.contains("fields", [fieldId]);

  const types = resolvePostTypes(input);
  if (types.length > 0) {
    qb = qb.or(`story_type.in.(${types.join(",")}),story_types.ov.{${types.join(",")}}`);
  }

  if (input.cursor && tab !== "for-you") {
    qb = qb.or(
      `published_at.lt.${input.cursor.published_at},and(published_at.eq.${input.cursor.published_at},id.lt.${input.cursor.id})`,
    );
  }

  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as unknown as BlogFeedRow[];

  const topicsByPost = await topicsForEntitiesServer(
    "post",
    rows.map((r) => r.id),
  );
  rows = rows.map((r) => ({ ...r, topics: topicsByPost.get(r.id) ?? [] }));

  if (tab === "for-you") {
    const ranked = rankForYou(rows, viewer);
    const start = input.cursor ? Number(input.cursor.id) || 0 : 0;
    const page = ranked.slice(start, start + limit);
    const nextStart = start + limit;
    return {
      posts: page,
      nextCursor:
        nextStart < ranked.length ? { published_at: "rank", id: String(nextStart) } : null,
      tab,
      topic,
    };
  }

  const hasMore = rows.length > limit;
  const posts = hasMore ? rows.slice(0, limit) : rows;
  const last = posts[posts.length - 1];
  const nextCursor =
    hasMore && last?.published_at ? { published_at: last.published_at, id: last.id } : null;
  return { posts, nextCursor, tab, topic };
}

function resolvePostTypes(input: BlogFeedInput): string[] {
  if (input.postType) return [input.postType];
  if (input.section) return storyTypesForSection(input.section);
  return [];
}

function intersect(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((v) => set.has(v));
}

/** Posts connected to anything the viewer follows: Topics, Mediums, authors. */
async function followedPostIdsServer(viewer: NonNullable<BlogFeedViewer>): Promise<string[]> {
  const client = topicsPublicClient();
  const ids = new Set<string>();

  if (viewer.topicIds.length > 0) {
    const { data } = await client
      .from("blog_post_topics")
      .select("post_id")
      .in("topic_id", viewer.topicIds)
      .limit(2000);
    for (const r of (data ?? []) as Array<{ post_id: string }>) ids.add(r.post_id);
  }

  if (viewer.authorProfileIds.length > 0) {
    const { data } = await client
      .from("blog_post_authors")
      .select("blog_post_id")
      .in("profile_id", viewer.authorProfileIds)
      .limit(2000);
    for (const r of (data ?? []) as Array<{ blog_post_id: string }>) ids.add(r.blog_post_id);
  }

  if (viewer.fieldIds.length > 0) {
    const { data } = await client
      .from("blog_posts")
      .select("id,fields")
      .eq("status", "published")
      .overlaps("fields", viewer.fieldIds)
      .limit(2000);
    for (const r of (data ?? []) as Array<{ id: string }>) ids.add(r.id);
  }

  return Array.from(ids);
}

/**
 * For You ranking: recency decay, plus signal for followed Topics, followed
 * Mediums, followed authors, and editorial featuring.
 */
export function rankForYou(rows: BlogFeedRow[], viewer: BlogFeedViewer): BlogFeedRow[] {
  const topicIds = new Set(viewer?.topicIds ?? []);
  const fieldIds = new Set(viewer?.fieldIds ?? []);
  const now = Date.now();

  return [...rows]
    .map((row) => {
      const published = row.published_at ? Date.parse(row.published_at) : 0;
      const ageDays = published ? Math.max(0, (now - published) / 86_400_000) : 365;
      let score = 100 / (1 + ageDays / 14);
      if (row.featured) score += 12;
      const rowTopics = (row.topics ?? []) as Topic[];
      if (rowTopics.some((t) => topicIds.has(t.id))) score += 40;
      const rowFields = Array.isArray(row.fields) ? (row.fields as string[]) : [];
      if (rowFields.some((f) => fieldIds.has(f))) score += 25;
      return { row, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ row }) => row);
}
