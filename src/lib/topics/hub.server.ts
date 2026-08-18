/**
 * Cross-entity Topic hub reads.
 *
 * A Topic page is not a blog archive — it is every public thing on Workshop
 * that shares that classification: Works, Blog posts, Collabs, Events, and
 * Groups. All reads go through the publishable-key client so hubs render for
 * logged-out visitors and prerender cleanly.
 */
import { topicsPublicClient } from "./topics.server";

export type TopicHubWork = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  category_canonical: string | null;
  created_at: string;
};

export type TopicHubCollab = {
  id: string;
  slug: string;
  title: string;
  category_canonical: string | null;
  location_mode: string;
  created_at: string;
};

export type TopicHubEvent = {
  id: string;
  slug: string | null;
  title: string;
  starts_at: string;
  cover_url: string | null;
  format: string;
};

export type TopicHubGroup = {
  id: string;
  slug: string;
  name: string;
  kind: string;
};

export type TopicHubResource = {
  id: string;
  name: string;
  website_url: string | null;
  category: string | null;
  short_description: string | null;
};

export type TopicHubEntities = {
  works: TopicHubWork[];
  collabs: TopicHubCollab[];
  events: TopicHubEvent[];
  groups: TopicHubGroup[];
  resources: TopicHubResource[];
};

const EMPTY: TopicHubEntities = {
  works: [],
  collabs: [],
  events: [],
  groups: [],
  resources: [],
};

async function joinIds(
  table: string,
  column: string,
  topicId: string,
  limit: number,
): Promise<string[]> {
  const { data } = await topicsPublicClient()
    .from(table as never)
    .select(column)
    .eq("topic_id", topicId)
    .limit(limit);
  return ((data ?? []) as Array<Record<string, string>>)
    .map((row) => row[column])
    .filter((v): v is string => !!v);
}

/** Everything public that carries this Topic, newest first, per entity kind. */
export async function topicHubEntities(
  topicId: string,
  perKind = 12,
): Promise<TopicHubEntities> {
  const client = topicsPublicClient();
  const cap = Math.min(Math.max(perKind, 1), 24);

  const [workIds, collabIds, eventIds, groupIds, resourceIds] = await Promise.all([
    joinIds("work_topics", "work_id", topicId, 200),
    joinIds("collab_post_topics", "collab_post_id", topicId, 200),
    joinIds("group_event_topics", "event_id", topicId, 200),
    joinIds("group_topics", "group_id", topicId, 200),
    joinIds("resource_topics", "resource_id", topicId, 200),
  ]);

  const nowIso = new Date().toISOString();

  const [works, collabs, events, groups, resources] = await Promise.all([
    workIds.length
      ? client
          .from("works")
          .select("id,slug,title,cover_url,category_canonical,created_at")
          .in("id", workIds)
          .eq("status", "published")
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(cap)
      : Promise.resolve({ data: [] }),
    collabIds.length
      ? client
          .from("collab_posts")
          .select("id,slug,title,category_canonical,location_mode,created_at")
          .in("id", collabIds)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(cap)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? client
          .from("group_events")
          .select("id,slug,title,starts_at,cover_url,format")
          .in("id", eventIds)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(cap)
      : Promise.resolve({ data: [] }),
    groupIds.length
      ? client
          .from("groups")
          .select("id,slug,name,kind")
          .in("id", groupIds)
          .eq("visibility", "public")
          .order("name", { ascending: true })
          .limit(cap)
      : Promise.resolve({ data: [] }),
    resourceIds.length
      ? client
          .from("resources")
          .select("id,name,website_url,category,short_description")
          .in("id", resourceIds)
          .eq("is_published", true)
          .order("name", { ascending: true })
          .limit(cap)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    ...EMPTY,
    works: ((works.data ?? []) as unknown as TopicHubWork[]),
    collabs: ((collabs.data ?? []) as unknown as TopicHubCollab[]),
    events: ((events.data ?? []) as unknown as TopicHubEvent[]),
    groups: ((groups.data ?? []) as unknown as TopicHubGroup[]),
    resources: ((resources.data ?? []) as unknown as TopicHubResource[]),
  };
}
