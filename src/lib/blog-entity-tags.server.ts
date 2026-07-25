import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS } from "@/lib/blog-entity-tags";

type Row = {
  work_id: string | null;
  collab_id: string | null;
  group_id: string | null;
  group_event_id: string | null;
  profile_id: string | null;
  sort_order: number;
};

type EntityInput = { kind: BlogEntityKind; id: string };

async function resolveTags(rows: Row[], opts: { publicOnly: boolean }): Promise<BlogEntityTag[]> {
  const workIds = rows.map((r) => r.work_id).filter(Boolean) as string[];
  const collabIds = rows.map((r) => r.collab_id).filter(Boolean) as string[];
  const groupIds = rows.map((r) => r.group_id).filter(Boolean) as string[];
  const eventIds = rows.map((r) => r.group_event_id).filter(Boolean) as string[];
  const profileIds = rows.map((r) => r.profile_id).filter(Boolean) as string[];

  const [works, collabs, groups, events, profiles] = await Promise.all([
    workIds.length
      ? supabaseAdmin
          .from("works")
          .select("id,slug,title,category,cover_url,visibility,status")
          .in("id", workIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; title: string; category: string | null; cover_url: string | null; visibility: string; status: string }> }),
    collabIds.length
      ? supabaseAdmin
          .from("collab_posts")
          .select("id,slug,title,description,cover_url,status")
          .in("id", collabIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; title: string; description: string | null; cover_url: string | null; status: string }> }),
    groupIds.length
      ? supabaseAdmin
          .from("groups")
          .select("id,slug,name,tagline,avatar_url,visibility,deleted_at")
          .in("id", groupIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; name: string; tagline: string | null; avatar_url: string | null; visibility: string; deleted_at: string | null }> }),
    eventIds.length
      ? supabaseAdmin
          .from("group_events")
          .select("id,slug,title,tagline,cover_url,starts_at,visibility,deleted_at,group:groups!group_events_group_id_fkey(slug,name,visibility,deleted_at)")
          .in("id", eventIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; title: string; tagline: string | null; cover_url: string | null; starts_at: string; visibility: string; deleted_at: string | null; group: { slug: string; name: string; visibility: string; deleted_at: string | null } | null }> }),
    profileIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id,username,display_name,avatar_url,headline,discoverable")
          .in("id", profileIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; tagline: string | null; discoverable: boolean }> }),
  ]);

  const workMap = new Map((works.data ?? []).map((w) => [w.id, w]));
  const collabMap = new Map((collabs.data ?? []).map((c) => [c.id, c]));
  const groupMap = new Map((groups.data ?? []).map((g) => [g.id, g]));
  const eventMap = new Map((events.data ?? []).map((e) => [e.id, e]));
  const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));

  const out: BlogEntityTag[] = [];
  for (const r of rows) {
    if (r.work_id) {
      const w = workMap.get(r.work_id);
      if (!w) continue;
      if (opts.publicOnly && (w.status !== "published" || w.visibility === "private")) continue;
      out.push({ kind: "work", id: w.id, slug: w.slug, label: w.title, sublabel: w.category ? w.category.charAt(0).toUpperCase() + w.category.slice(1) : null, image: w.cover_url });
      continue;
    }
    if (r.collab_id) {
      const c = collabMap.get(r.collab_id);
      if (!c) continue;
      out.push({ kind: "collab", id: c.id, slug: c.slug, label: c.title, sublabel: c.description ?? null, image: c.cover_url });
      continue;
    }
    if (r.group_id) {
      const g = groupMap.get(r.group_id);
      if (!g) continue;
      if (opts.publicOnly && (g.visibility !== "public" || g.deleted_at)) continue;
      out.push({ kind: "group", id: g.id, slug: g.slug, label: g.name, sublabel: g.tagline ?? null, image: g.avatar_url });
      continue;
    }
    if (r.group_event_id) {
      const e = eventMap.get(r.group_event_id);
      if (!e || !e.group?.slug) continue;
      if (opts.publicOnly && (e.visibility === "private" || e.deleted_at || e.group.deleted_at)) continue;
      out.push({ kind: "event", id: e.id, slug: e.slug, groupSlug: e.group.slug, label: e.title, sublabel: e.group.name, image: e.cover_url });
      continue;
    }
    if (r.profile_id) {
      const p = profileMap.get(r.profile_id);
      if (!p || !p.username) continue;
      if (opts.publicOnly && p.discoverable === false) continue;
      out.push({ kind: "profile", id: p.id, username: p.username, label: p.display_name || p.username, sublabel: p.headline ?? `@${p.username}`, image: p.avatar_url });
      continue;
    }
  }
  return out;
}

export async function getBlogPostEntityTagsServer(
  postId: string,
  opts: { publicOnly: boolean } = { publicOnly: true },
): Promise<BlogEntityTag[]> {
  const { data, error } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("work_id,collab_id,group_id,group_event_id,profile_id,sort_order")
    .eq("blog_post_id", postId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return resolveTags((data ?? []) as Row[], opts);
}

/** Bulk fetch tags for multiple posts (public mode). Returns Map<postId, tags>. */
export async function getBlogPostEntityTagsBulkServer(postIds: string[]): Promise<Map<string, BlogEntityTag[]>> {
  const out = new Map<string, BlogEntityTag[]>();
  if (!postIds.length) return out;
  const { data } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("blog_post_id,work_id,collab_id,group_id,group_event_id,profile_id,sort_order")
    .in("blog_post_id", postIds)
    .order("sort_order", { ascending: true });
  const rowsByPost = new Map<string, Row[]>();
  for (const r of (data ?? []) as Array<Row & { blog_post_id: string }>) {
    const arr = rowsByPost.get(r.blog_post_id) ?? [];
    arr.push(r);
    rowsByPost.set(r.blog_post_id, arr);
  }
  for (const [postId, rows] of rowsByPost) {
    out.set(postId, await resolveTags(rows, { publicOnly: true }));
  }
  return out;
}

async function validateEntitiesExist(inputs: EntityInput[]) {
  const byKind: Record<BlogEntityKind, string[]> = { work: [], collab: [], group: [], event: [], profile: [] };
  for (const t of inputs) byKind[t.kind].push(t.id);

  const checks: Array<Promise<{ kind: BlogEntityKind; found: Set<string> }>> = [];
  if (byKind.work.length) {
    checks.push(supabaseAdmin.from("works").select("id").in("id", byKind.work).then(({ data }) => ({ kind: "work", found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.collab.length) {
    checks.push(supabaseAdmin.from("collab_posts").select("id").in("id", byKind.collab).then(({ data }) => ({ kind: "collab", found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.group.length) {
    checks.push(supabaseAdmin.from("groups").select("id").in("id", byKind.group).then(({ data }) => ({ kind: "group", found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.event.length) {
    checks.push(supabaseAdmin.from("group_events").select("id").in("id", byKind.event).then(({ data }) => ({ kind: "event", found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.profile.length) {
    checks.push(supabaseAdmin.from("profiles").select("id").in("id", byKind.profile).then(({ data }) => ({ kind: "profile", found: new Set((data ?? []).map((r) => r.id)) })));
  }
  const results = await Promise.all(checks);
  const foundByKind = new Map(results.map((r) => [r.kind, r.found]));
  for (const t of inputs) {
    const found = foundByKind.get(t.kind);
    if (!found || !found.has(t.id)) throw new Error(`Tagged ${t.kind} not found.`);
  }
}

function dedupeAndCap(inputs: EntityInput[]): EntityInput[] {
  const seen = new Set<string>();
  const out: EntityInput[] = [];
  for (const t of inputs) {
    const key = `${t.kind}:${t.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_BLOG_ENTITY_TAGS) break;
  }
  return out;
}

async function replaceTagsRaw(postId: string, actor: string, inputs: EntityInput[]) {
  const clean = dedupeAndCap(inputs);
  if (clean.length) await validateEntitiesExist(clean);
  const { error } = await supabaseAdmin.rpc("replace_blog_post_entity_tags", {
    _post_id: postId,
    _tags: clean.map((t) => ({ kind: t.kind, id: t.id })),
    _actor: actor,
  });
  if (error) throw new Error(error.message);
  return getBlogPostEntityTagsServer(postId, { publicOnly: false });
}

/** Owner or admin sets tags on their own post. */
export async function setBlogPostEntityTagsForOwnerServer(
  postId: string,
  userId: string,
  inputs: EntityInput[],
): Promise<BlogEntityTag[]> {
  const { data: post, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id,created_by")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) throw new Error("Post not found.");
  if (post.created_by !== userId) {
    const { data: isAdmin } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!isAdmin) throw new Error("Forbidden.");
  }
  return replaceTagsRaw(postId, userId, inputs);
}

/** Admin sets tags on any post. */
export async function setBlogPostEntityTagsForAdminServer(
  context: { userId: string },
  postId: string,
  inputs: EntityInput[],
): Promise<BlogEntityTag[]> {
  const { data: isAdmin } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!isAdmin) throw new Error("Forbidden: admin only");
  return replaceTagsRaw(postId, context.userId, inputs);
}

/** Called before publish: any tagged entity that has become non-public throws a friendly error. */
export async function assertTaggedEntitiesPubliclyVisibleServer(postId: string): Promise<void> {
  const rows = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("work_id,collab_id,group_id,group_event_id,profile_id,sort_order")
    .eq("blog_post_id", postId)
    .order("sort_order", { ascending: true });
  const publicTags = await resolveTags((rows.data ?? []) as Row[], { publicOnly: true });
  const allTags = await resolveTags((rows.data ?? []) as Row[], { publicOnly: false });
  if (publicTags.length < allTags.length) {
    throw new Error("One of the entities connected to this post is no longer public. Remove it before publishing.");
  }
}

type PublicPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  published_at: string | null;
};

/** Reverse discovery: recently-published blog posts tagged with a given entity. */
export async function listBlogPostsForEntityServer(
  kind: BlogEntityKind,
  entityId: string,
  limit = 3,
): Promise<PublicPostSummary[]> {
  const column: Record<BlogEntityKind, string> = {
    work: "work_id",
    collab: "collab_id",
    group: "group_id",
    event: "group_event_id",
    profile: "profile_id",
  };
  const { data: tagRows, error: tagErr } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("blog_post_id")
    .eq(column[kind], entityId);
  if (tagErr) throw new Error(tagErr.message);
  const postIds = Array.from(new Set((tagRows ?? []).map((r) => (r as { blog_post_id: string }).blog_post_id)));
  if (!postIds.length) return [];
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index")
    .in("id", postIds)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: (r as PublicPostSummary).id,
    slug: (r as PublicPostSummary).slug,
    title: (r as PublicPostSummary).title,
    excerpt: (r as PublicPostSummary).excerpt,
    cover_image_url: (r as PublicPostSummary).cover_image_url,
    cover_image_alt: (r as PublicPostSummary).cover_image_alt,
    author_name: (r as PublicPostSummary).author_name,
    published_at: (r as PublicPostSummary).published_at,
  }));
}

/** Rank related posts: prefer those that share tagged entities with `postId`, then fill by recency. */
export async function getRelatedPostsRankedServer(postId: string, limit: number): Promise<PublicPostSummary[]> {
  // 1) Find this post's tagged entities.
  const { data: myRows } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("work_id,collab_id,group_id,group_event_id,profile_id")
    .eq("blog_post_id", postId);

  const workIds: string[] = [];
  const collabIds: string[] = [];
  const groupIds: string[] = [];
  const eventIds: string[] = [];
  const profileIds: string[] = [];
  for (const r of (myRows ?? []) as Row[]) {
    if (r.work_id) workIds.push(r.work_id);
    if (r.collab_id) collabIds.push(r.collab_id);
    if (r.group_id) groupIds.push(r.group_id);
    if (r.group_event_id) eventIds.push(r.group_event_id);
    if (r.profile_id) profileIds.push(r.profile_id);
  }

  const overlap = new Map<string, number>(); // post_id -> shared-entity count
  if (workIds.length || collabIds.length || groupIds.length || eventIds.length || profileIds.length) {
    let q = supabaseAdmin.from("blog_post_entity_tags").select("blog_post_id");
    const orParts: string[] = [];
    if (workIds.length) orParts.push(`work_id.in.(${workIds.join(",")})`);
    if (collabIds.length) orParts.push(`collab_id.in.(${collabIds.join(",")})`);
    if (groupIds.length) orParts.push(`group_id.in.(${groupIds.join(",")})`);
    if (eventIds.length) orParts.push(`group_event_id.in.(${eventIds.join(",")})`);
    if (profileIds.length) orParts.push(`profile_id.in.(${profileIds.join(",")})`);
    if (orParts.length) q = q.or(orParts.join(","));
    const { data: siblingRows } = await q;
    for (const r of (siblingRows ?? []) as Array<{ blog_post_id: string }>) {
      if (r.blog_post_id === postId) continue;
      overlap.set(r.blog_post_id, (overlap.get(r.blog_post_id) ?? 0) + 1);
    }
  }

  const rankedIds = [...overlap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const out: PublicPostSummary[] = [];
  if (rankedIds.length) {
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index")
      .in("id", rankedIds.slice(0, limit * 2))
      .eq("status", "published")
      .eq("show_in_blog_index", true)
      .lte("published_at", new Date().toISOString());
    const byId = new Map((data ?? []).map((r) => [(r as PublicPostSummary).id, r as PublicPostSummary]));
    for (const id of rankedIds) {
      const row = byId.get(id);
      if (row) out.push(row);
      if (out.length >= limit) break;
    }
  }

  if (out.length < limit) {
    const excludeIds = [postId, ...out.map((p) => p.id)];
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select("id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index")
      .eq("status", "published")
      .eq("show_in_blog_index", true)
      .lte("published_at", new Date().toISOString())
      .not("id", "in", `(${excludeIds.join(",")})`)
      .order("published_at", { ascending: false })
      .limit(limit - out.length);
    for (const r of (data ?? []) as PublicPostSummary[]) out.push(r);
  }
  return out.slice(0, limit);
}
