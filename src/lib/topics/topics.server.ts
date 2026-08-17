/**
 * Server-side Topic + Medium reads and writes.
 *
 * Public reads go through the publishable-key client (anon SELECT policies).
 * Writes are performed with the caller's authenticated client so RLS decides
 * who may retag an entity.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mediumLabel, mediumSlugForField, normalizeTopicNames, topicSlug, type Medium, type Topic } from "@/lib/topics/topics";
import type { FieldId } from "@/lib/taxonomy";

export type TopicEntityKind = "post" | "work" | "group" | "collab" | "event";

const JOIN: Record<TopicEntityKind, { table: string; column: string }> = {
  post: { table: "blog_post_topics", column: "post_id" },
  work: { table: "work_topics", column: "work_id" },
  group: { table: "group_topics", column: "group_id" },
  collab: { table: "collab_post_topics", column: "collab_post_id" },
  event: { table: "group_event_topics", column: "event_id" },
};

export function topicsPublicClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Topics service is unavailable.");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const TOPIC_COLUMNS = "id,slug,name,short_description,about_markdown,featured";

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

export async function searchTopicsServer(q: string, limit = 20): Promise<Topic[]> {
  const client = topicsPublicClient();
  let qb = client
    .from("topics")
    .select(TOPIC_COLUMNS)
    .eq("status", "active")
    .order("featured", { ascending: false })
    .order("name", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));
  const term = q.trim();
  if (term) qb = qb.ilike("name", `%${term}%`);
  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Topic[];
}

export async function getTopicBySlugServer(slug: string): Promise<Topic | null> {
  const { data, error } = await topicsPublicClient()
    .from("topics")
    .select(TOPIC_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Topic) ?? null;
}

export async function getMediumBySlugServer(slug: string): Promise<Medium | null> {
  const { data, error } = await topicsPublicClient()
    .from("mediums")
    .select("field_id,slug,short_description,about_markdown,featured")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as unknown as {
    field_id: string;
    slug: string;
    short_description: string | null;
    about_markdown: string | null;
    featured: boolean;
  };
  return {
    field_id: row.field_id as FieldId,
    slug: row.slug,
    label: mediumLabel(row.field_id),
    short_description: row.short_description,
    about_markdown: row.about_markdown,
    featured: row.featured,
  };
}

export async function listMediumsServer(): Promise<Medium[]> {
  const { data, error } = await topicsPublicClient()
    .from("mediums")
    .select("field_id,slug,short_description,featured");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<{
    field_id: string;
    slug: string;
    short_description: string | null;
    featured: boolean;
  }>)
    .map((r) => ({
      field_id: r.field_id as FieldId,
      slug: r.slug,
      label: mediumLabel(r.field_id),
      short_description: r.short_description,
      featured: r.featured,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Topics attached to a set of entities of one kind, in author order. */
export async function topicsForEntitiesServer(
  kind: TopicEntityKind,
  ids: string[],
): Promise<Map<string, Topic[]>> {
  const out = new Map<string, Topic[]>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return out;
  const { table, column } = JOIN[kind];
  const { data, error } = await topicsPublicClient()
    .from(table as "blog_post_topics")
    .select(`${column},sort_order,topic:topics(${TOPIC_COLUMNS})`)
    .in(column, unique)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    const entityId = row[column] as string;
    const topic = row.topic as Topic | null;
    if (!topic) continue;
    const list = out.get(entityId) ?? [];
    list.push(topic);
    out.set(entityId, list);
  }
  return out;
}

/** Entity ids carrying a given Topic. */
export async function entityIdsForTopicServer(
  kind: TopicEntityKind,
  topicId: string,
  limit = 200,
): Promise<string[]> {
  const { table, column } = JOIN[kind];
  const { data, error } = await topicsPublicClient()
    .from(table as "blog_post_topics")
    .select(column)
    .eq("topic_id", topicId)
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Array<Record<string, string>>).map((r) => r[column]!);
}

export async function topicPostCountsServer(topicIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = Array.from(new Set(topicIds.filter(Boolean)));
  if (unique.length === 0) return counts;
  const { data, error } = await topicsPublicClient()
    .from("blog_post_topics")
    .select("topic_id")
    .in("topic_id", unique)
    .limit(5000);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as Array<{ topic_id: string }>) {
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }
  return counts;
}

/** The Topics used most across published Blog posts. */
export async function trendingTopicsServer(limit = 24): Promise<Array<Topic & { count: number }>> {
  const topics = await searchTopicsServer("", 50);
  const counts = await topicPostCountsServer(topics.map((t) => t.id));
  return topics
    .map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Find-or-create canonical Topics for a list of names, preserving order.
 * Runs with the given client so RLS applies (any signed-in member may create).
 */
export async function ensureTopicsServer(
  client: SupabaseClient<Database>,
  names: string[],
  createdBy?: string,
): Promise<Topic[]> {
  const clean = normalizeTopicNames(names, 10);
  if (clean.length === 0) return [];
  const slugs = clean.map(topicSlug);

  const { data: existing, error } = await client
    .from("topics")
    .select(TOPIC_COLUMNS)
    .in("slug", slugs);
  if (error) throw new Error(error.message);
  const bySlug = new Map<string, Topic>(
    ((existing ?? []) as unknown as Topic[]).map((t) => [t.slug, t]),
  );

  const missing = clean.filter((name) => !bySlug.has(topicSlug(name)));
  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await client
      .from("topics")
      .upsert(
        missing.map((name) => ({
          slug: topicSlug(name),
          name,
          created_by: createdBy ?? null,
        })),
        { onConflict: "slug", ignoreDuplicates: true },
      )
      .select(TOPIC_COLUMNS);
    if (insertError) throw new Error(insertError.message);
    for (const t of (inserted ?? []) as unknown as Topic[]) bySlug.set(t.slug, t);

    const stillMissing = clean.map(topicSlug).filter((s) => !bySlug.has(s));
    if (stillMissing.length > 0) {
      const { data: refetched } = await client
        .from("topics")
        .select(TOPIC_COLUMNS)
        .in("slug", stillMissing);
      for (const t of ((refetched ?? []) as unknown as Topic[])) bySlug.set(t.slug, t);
    }
  }

  return clean.map((name) => bySlug.get(topicSlug(name))).filter((t): t is Topic => !!t);
}

/** Replace an entity's Topic connections with `names`, in the given order. */
export async function setEntityTopicsServer(
  client: SupabaseClient<Database>,
  kind: TopicEntityKind,
  entityId: string,
  names: string[],
  createdBy?: string,
): Promise<Topic[]> {
  const { table, column } = JOIN[kind];
  const topics = await ensureTopicsServer(client, names, createdBy);

  const del = await client
    .from(table as "blog_post_topics")
    .delete()
    .eq(column, entityId);
  if (del.error) throw new Error(del.error.message);

  if (topics.length > 0) {
    const rows = topics.map((t, index) => ({
      [column]: entityId,
      topic_id: t.id,
      sort_order: index,
    }));
    const ins = await client
      .from(table as "blog_post_topics")
      .insert(rows as never);
    if (ins.error) throw new Error(ins.error.message);
  }
  return topics;
}

/* -------------------------------------------------------------------------- */
/* Follows                                                                     */
/* -------------------------------------------------------------------------- */

export async function myFollowsServer(client: SupabaseClient<Database>, userId: string) {
  const [topics, mediums] = await Promise.all([
    client.from("topic_follows").select("topic_id").eq("user_id", userId),
    client.from("medium_follows").select("field_id").eq("user_id", userId),
  ]);
  if (topics.error) throw new Error(topics.error.message);
  if (mediums.error) throw new Error(mediums.error.message);
  return {
    topicIds: ((topics.data ?? []) as Array<{ topic_id: string }>).map((r) => r.topic_id),
    fieldIds: ((mediums.data ?? []) as Array<{ field_id: string }>).map((r) => r.field_id),
  };
}

export async function toggleTopicFollowServer(
  client: SupabaseClient<Database>,
  userId: string,
  topicId: string,
  follow: boolean,
) {
  if (follow) {
    const { error } = await client
      .from("topic_follows")
      .upsert({ user_id: userId, topic_id: topicId }, { onConflict: "user_id,topic_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from("topic_follows")
      .delete()
      .eq("user_id", userId)
      .eq("topic_id", topicId);
    if (error) throw new Error(error.message);
  }
  return { following: follow };
}

export async function toggleMediumFollowServer(
  client: SupabaseClient<Database>,
  userId: string,
  fieldId: string,
  follow: boolean,
) {
  if (follow) {
    const { error } = await client
      .from("medium_follows")
      .upsert({ user_id: userId, field_id: fieldId }, { onConflict: "user_id,field_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .from("medium_follows")
      .delete()
      .eq("user_id", userId)
      .eq("field_id", fieldId);
    if (error) throw new Error(error.message);
  }
  return { following: follow };
}

export { mediumSlugForField };

/**
 * Mirror a Blog post's authored Subjects into canonical Topic connections.
 * Subjects remain the authoring surface; Topics are the canonical graph the
 * feed, hubs, and follows read from.
 */
export async function syncPostTopicsAdminServer(
  postId: string,
  names: string[],
  createdBy?: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return setEntityTopicsServer(
    supabaseAdmin as unknown as SupabaseClient<Database>,
    "post",
    postId,
    names,
    createdBy,
  );
}
