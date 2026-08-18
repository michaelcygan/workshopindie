/**
 * Database-backed canonical Topic lookup and member creation.
 *
 * Lookup order: exact preferred label → exact alias → label prefix → alias
 * prefix → fuzzy contains. Everything is filtered in Postgres; we never fetch
 * the whole vocabulary into the browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { topicsPublicClient } from "@/lib/topics/topics.server";
import { cleanTopicLabel, normalizeTopicKey, topicLabelError } from "@/lib/topics/normalize";
import { topicSlug, type Topic } from "@/lib/topics/topics";

export const TOPIC_COLUMNS =
  "id,slug,name,short_description,about_markdown,featured,status,family,review_state,broader_topic_id,merged_into_topic_id";

export type TopicRow = Topic & {
  status: string;
  family: string | null;
  review_state: string;
  broader_topic_id: string | null;
  merged_into_topic_id: string | null;
};

function escapeLike(term: string): string {
  return term.replace(/[%_]/g, (m) => `\\${m}`);
}

function push(out: TopicRow[], seen: Set<string>, rows: TopicRow[] | null) {
  for (const row of rows ?? []) {
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
}

/** Ranked active-Topic search across preferred labels and aliases. */
export async function searchCanonicalTopics(
  query: string,
  limit = 12,
): Promise<{ topics: TopicRow[]; exactMatch: TopicRow | null }> {
  const client = topicsPublicClient();
  const term = cleanTopicLabel(query);
  const key = normalizeTopicKey(term);
  const cap = Math.min(Math.max(limit, 1), 30);

  if (!key) {
    const { data } = await client
      .from("topics")
      .select(TOPIC_COLUMNS)
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("editorial_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(cap);
    return { topics: (data ?? []) as unknown as TopicRow[], exactMatch: null };
  }

  const like = escapeLike(term);
  const [exact, aliasExact, prefix, aliasPrefix, contains] = await Promise.all([
    client.from("topics").select(TOPIC_COLUMNS).eq("status", "active").eq("normalized_key", key).limit(1),
    client
      .from("topic_aliases")
      .select(`normalized_alias,topic:topics(${TOPIC_COLUMNS})`)
      .eq("normalized_alias", key)
      .limit(3),
    client
      .from("topics")
      .select(TOPIC_COLUMNS)
      .eq("status", "active")
      .ilike("name", `${like}%`)
      .order("featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(cap),
    client
      .from("topic_aliases")
      .select(`alias,topic:topics(${TOPIC_COLUMNS})`)
      .ilike("alias", `${like}%`)
      .limit(cap),
    client
      .from("topics")
      .select(TOPIC_COLUMNS)
      .eq("status", "active")
      .ilike("name", `%${like}%`)
      .order("featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(cap),
  ]);

  const out: TopicRow[] = [];
  const seen = new Set<string>();
  const aliasRows = (rows: unknown): TopicRow[] =>
    ((rows ?? []) as Array<{ topic: TopicRow | null }>)
      .map((r) => r.topic)
      .filter((t): t is TopicRow => !!t && t.status === "active");

  push(out, seen, exact.data as unknown as TopicRow[]);
  const exactMatch = out[0] ?? null;
  push(out, seen, aliasRows(aliasExact.data));
  const aliasHit = out[0] ?? null;
  push(out, seen, prefix.data as unknown as TopicRow[]);
  push(out, seen, aliasRows(aliasPrefix.data));
  push(out, seen, contains.data as unknown as TopicRow[]);

  return { topics: out.slice(0, cap), exactMatch: exactMatch ?? (aliasHit && out.length ? aliasHit : null) };
}

/** Resolve a Topic by slug, following merges and old-slug redirects. */
export async function resolveTopicSlug(
  slug: string,
): Promise<{ topic: TopicRow; canonicalSlug: string } | null> {
  const client = topicsPublicClient();
  const clean = slug.trim().toLowerCase();
  const { data } = await client.from("topics").select(TOPIC_COLUMNS).eq("slug", clean).maybeSingle();
  let row = (data as unknown as TopicRow) ?? null;

  if (!row) {
    const { data: redirect } = await client
      .from("topic_slug_redirects")
      .select(`topic:topics(${TOPIC_COLUMNS})`)
      .eq("old_slug", clean)
      .maybeSingle();
    row = ((redirect as unknown as { topic: TopicRow | null } | null)?.topic) ?? null;
  }
  if (!row) return null;

  if (row.merged_into_topic_id) {
    const { data: target } = await client
      .from("topics")
      .select(TOPIC_COLUMNS)
      .eq("id", row.merged_into_topic_id)
      .maybeSingle();
    if (target) row = target as unknown as TopicRow;
  }
  return { topic: row, canonicalSlug: row.slug };
}

/** Fetch canonical Topics by id (used to hydrate pickers and detail pages). */
export async function topicsByIds(ids: string[]): Promise<TopicRow[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data } = await topicsPublicClient().from("topics").select(TOPIC_COLUMNS).in("id", unique);
  const rows = (data ?? []) as unknown as TopicRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => byId.get(id)).filter((t): t is TopicRow => !!t);
}

export class TopicExistsError extends Error {
  constructor(public topic: TopicRow) {
    super("Topic already exists");
  }
}

/**
 * Create a canonical Topic on behalf of a member. Races collapse onto the
 * surviving row instead of failing.
 */
export async function createCanonicalTopic(
  client: SupabaseClient<Database>,
  rawLabel: string,
  userId: string,
): Promise<{ topic: TopicRow; created: boolean }> {
  const label = cleanTopicLabel(rawLabel);
  const error = topicLabelError(label);
  if (error) throw new Error(error);
  const key = normalizeTopicKey(label);

  const existing = await searchCanonicalTopics(label, 1);
  if (existing.exactMatch) return { topic: existing.exactMatch, created: false };

  let slug = topicSlug(label);
  const { data: slugTaken } = await topicsPublicClient()
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (slugTaken) slug = `${slug}-${key.length}${Math.random().toString(36).slice(2, 6)}`;

  const { data: inserted, error: insertError } = await client
    .from("topics")
    .insert({
      slug,
      name: label,
      created_by: userId,
      status: "active",
      review_state: "needs_review",
    } as never)
    .select(TOPIC_COLUMNS)
    .maybeSingle();

  if (insertError) {
    // Unique violation (normalized key or slug) — return the surviving Topic.
    const survivor = await searchCanonicalTopics(label, 1);
    if (survivor.exactMatch) return { topic: survivor.exactMatch, created: false };
    throw new Error(insertError.message);
  }
  if (!inserted) throw new Error("Topic could not be created.");
  return { topic: inserted as unknown as TopicRow, created: true };
}
