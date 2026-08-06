import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BlogEntityKind, BlogEntityTag } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS } from "@/lib/blog-entity-tags";
import {
  isWorkPubliclyReferenceable,
  isCollabPubliclyReferenceable,
  isGroupPubliclyReferenceable,
  isEventPubliclyReferenceable,
  isProfilePubliclyReferenceable,
} from "@/lib/entities/visibility";

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

  const [works, collabs, groups, events, profiles, workCredits] = await Promise.all([
    workIds.length
      ? supabaseAdmin
          .from("works")
          .select(
            "id,slug,title,category,categories,subtype,excerpt,cover_url,cover_aspect,cover_focal_x,cover_focal_y,visibility,status",
          )
          .in("id", workIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; title: string; category: string | null; categories: string[] | null; subtype: string | null; excerpt: string | null; cover_url: string | null; cover_aspect: string | null; cover_focal_x: number | null; cover_focal_y: number | null; visibility: string; status: string }> }),

    collabIds.length
      ? supabaseAdmin
          .from("collab_posts")
          .select("id,slug,title,description,status,archived_at,resulting_work_id")
          .in("id", collabIds)
      : Promise.resolve({ data: [] as Array<{ id: string; slug: string; title: string; description: string | null; status: string; archived_at: string | null; resulting_work_id: string | null }> }),
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
      : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; headline: string | null; discoverable: boolean }> }),
    workIds.length
      ? supabaseAdmin
          .from("work_credits")
          .select("work_id,user_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)")
          .in("work_id", workIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ work_id: string; user_id: string | null; role_label: string | null; profiles: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null }> }),
  ]);

  const workMap = new Map((works.data ?? []).map((w) => [w.id, w]));
  const collabMap = new Map((collabs.data ?? []).map((c) => [c.id, c]));
  const groupMap = new Map((groups.data ?? []).map((g) => [g.id, g]));
  const eventMap = new Map((events.data ?? []).map((e) => [e.id, e]));
  const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));

  type CreditRow = {
    work_id: string;
    user_id: string | null;
    role_label: string | null;
    profiles: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  };
  const creditsByWork = new Map<string, CreditRow[]>();
  for (const c of ((workCredits.data ?? []) as unknown as CreditRow[])) {
    const arr = creditsByWork.get(c.work_id) ?? [];
    arr.push(c);
    creditsByWork.set(c.work_id, arr);
  }

  const out: BlogEntityTag[] = [];
  for (const r of rows) {
    if (r.work_id) {
      const w = workMap.get(r.work_id);
      if (!w) continue;
      const isPublic = isWorkPubliclyReferenceable(w);
      if (opts.publicOnly && !isPublic) continue;
      out.push({
        kind: "work",
        id: w.id,
        slug: w.slug,
        label: w.title,
        sublabel: w.category ? w.category.charAt(0).toUpperCase() + w.category.slice(1) : null,
        image: w.cover_url,
        work: isPublic
          ? {
              excerpt: w.excerpt ?? null,
              categories: (w.categories ?? []).length ? (w.categories as string[]) : w.category ? [w.category] : [],
              subtype: w.subtype ?? null,
              cover_url: w.cover_url ?? null,
              cover_aspect: w.cover_aspect ?? null,
              cover_focal_x: w.cover_focal_x ?? null,
              cover_focal_y: w.cover_focal_y ?? null,
              credits: (creditsByWork.get(w.id) ?? []).slice(0, 3).map((c) => ({
                id: c.user_id ?? c.profiles?.id ?? "",
                username: c.profiles?.username ?? null,
                display_name: c.profiles?.display_name ?? null,
                avatar_url: c.profiles?.avatar_url ?? null,
                role_label: c.role_label ?? null,
              })),
            }
          : null,
      });

      continue;
    }
    if (r.collab_id) {
      const c = collabMap.get(r.collab_id);
      if (!c) continue;
      // A finished or closed Collab is still valid editorial context; an
      // archived or legacy-draft one is not public and must not resolve.
      if (opts.publicOnly && !isCollabPubliclyReferenceable(c)) continue;
      out.push({ kind: "collab", id: c.id, slug: c.slug, label: c.title, sublabel: c.description ?? null, image: null });
      continue;
    }
    if (r.group_id) {
      const g = groupMap.get(r.group_id);
      if (!g) continue;
      if (opts.publicOnly && !isGroupPubliclyReferenceable(g)) continue;
      out.push({ kind: "group", id: g.id, slug: g.slug, label: g.name, sublabel: g.tagline ?? null, image: g.avatar_url });
      continue;
    }
    if (r.group_event_id) {
      const e = eventMap.get(r.group_event_id);
      if (!e || !e.group?.slug) continue;
      if (opts.publicOnly && !isEventPubliclyReferenceable(e, e.group)) continue;
      out.push({ kind: "event", id: e.id, slug: e.slug, groupSlug: e.group.slug, label: e.title, sublabel: e.group.name, image: e.cover_url });
      continue;
    }
    if (r.profile_id) {
      const p = profileMap.get(r.profile_id);
      if (!p || !p.username) continue;
      if (opts.publicOnly && !isProfilePubliclyReferenceable(p)) continue;
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

/** Bulk fetch tags for multiple posts. Returns Map<postId, tags>. */
export async function getBlogPostEntityTagsBulkServer(
  postIds: string[],
  opts: { publicOnly: boolean } = { publicOnly: true },
): Promise<Map<string, BlogEntityTag[]>> {
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
    out.set(postId, await resolveTags(rows, opts));
  }
  return out;
}


async function validateEntitiesExist(inputs: EntityInput[]) {
  const byKind: Record<BlogEntityKind, string[]> = { work: [], collab: [], group: [], event: [], profile: [] };
  for (const t of inputs) byKind[t.kind].push(t.id);

  const checks: Array<PromiseLike<{ kind: BlogEntityKind; found: Set<string> }>> = [];
  if (byKind.work.length) {
    checks.push(supabaseAdmin.from("works").select("id").in("id", byKind.work).then(({ data }) => ({ kind: "work" as BlogEntityKind, found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.collab.length) {
    checks.push(supabaseAdmin.from("collab_posts").select("id").in("id", byKind.collab).then(({ data }) => ({ kind: "collab" as BlogEntityKind, found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.group.length) {
    checks.push(supabaseAdmin.from("groups").select("id").in("id", byKind.group).then(({ data }) => ({ kind: "group" as BlogEntityKind, found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.event.length) {
    checks.push(supabaseAdmin.from("group_events").select("id").in("id", byKind.event).then(({ data }) => ({ kind: "event" as BlogEntityKind, found: new Set((data ?? []).map((r) => r.id)) })));
  }
  if (byKind.profile.length) {
    checks.push(supabaseAdmin.from("profiles").select("id").in("id", byKind.profile).then(({ data }) => ({ kind: "profile" as BlogEntityKind, found: new Set((data ?? []).map((r) => r.id)) })));
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

type PostAuthorSummary = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role_label: string | null;
};

type PublicPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  author_name: string;
  published_at: string | null;
  authors?: PostAuthorSummary[];
};

/** True when the entity itself is still publicly visible. */
async function entityIsPublic(kind: BlogEntityKind, entityId: string): Promise<boolean> {
  const row: Row = {
    work_id: kind === "work" ? entityId : null,
    collab_id: kind === "collab" ? entityId : null,
    group_id: kind === "group" ? entityId : null,
    group_event_id: kind === "event" ? entityId : null,
    profile_id: kind === "profile" ? entityId : null,
    sort_order: 0,
  };
  const tags = await resolveTags([row], { publicOnly: true });
  return tags.length > 0;
}

/**
 * Reverse discovery: recently-published blog posts tagged with a given entity.
 *
 * For Works, `trustedOnly` limits the surface to stories written by the Work's
 * creator, a credited collaborator, or Workshop editorial — anyone else can tag
 * a Work, but only trusted context is echoed back onto the Work page.
 */
export async function listBlogPostsForEntityServer(
  kind: BlogEntityKind,
  entityId: string,
  limit = 3,
  opts: { trustedOnly?: boolean } = {},
): Promise<PublicPostSummary[]> {
  const column: Record<BlogEntityKind, string> = {
    work: "work_id",
    collab: "collab_id",
    group: "group_id",
    event: "group_event_id",
    profile: "profile_id",
  };
  if (!(await entityIsPublic(kind, entityId))) return [];

  const { data: tagRows, error: tagErr } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select("blog_post_id")
    .eq(column[kind], entityId);
  if (tagErr) throw new Error(tagErr.message);
  const postIds = Array.from(new Set((tagRows ?? []).map((r) => (r as { blog_post_id: string }).blog_post_id)));
  if (!postIds.length) return [];

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select(
      "id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index,created_by,author_profile_id,publication_type",
    )
    .in("id", postIds)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(Math.max(limit * 3, limit));
  if (error) throw new Error(error.message);

  type PostRow = PublicPostSummary & {
    created_by: string | null;
    author_profile_id: string | null;
    publication_type: string | null;
  };
  let rows = (data ?? []) as unknown as PostRow[];
  if (!rows.length) return [];

  // Attributed authors (with role labels) for every candidate post.
  const { data: authorRows } = await supabaseAdmin
    .from("blog_post_authors")
    .select("blog_post_id,profile_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)")
    .in(
      "blog_post_id",
      rows.map((r) => r.id),
    )
    .order("sort_order", { ascending: true });
  type AuthorRow = {
    blog_post_id: string;
    profile_id: string;
    role_label: string | null;
    profiles: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  };
  const authorsByPost = new Map<string, AuthorRow[]>();
  for (const a of (authorRows ?? []) as unknown as AuthorRow[]) {
    const arr = authorsByPost.get(a.blog_post_id) ?? [];
    arr.push(a);
    authorsByPost.set(a.blog_post_id, arr);
  }

  // Trusted-context filter + credit-aware role labels for Works.
  const creditRole = new Map<string, string>();
  if (kind === "work") {
    const [{ data: work }, { data: creditRows }] = await Promise.all([
      supabaseAdmin.from("works").select("created_by").eq("id", entityId).maybeSingle(),
      supabaseAdmin.from("work_credits").select("user_id,role_label,sort_order").eq("work_id", entityId),
    ]);
    const trusted = new Set<string>();
    const ownerId = (work as { created_by: string | null } | null)?.created_by ?? null;
    if (ownerId) trusted.add(ownerId);
    for (const c of (creditRows ?? []) as Array<{ user_id: string | null; role_label: string | null }>) {
      if (!c.user_id) continue;
      trusted.add(c.user_id);
      if (c.role_label) creditRole.set(c.user_id, c.role_label);
    }
    if (opts.trustedOnly) {
      rows = rows.filter((r) => {
        if (r.publication_type && r.publication_type !== "member") return true; // editorial / admin
        const authorIds = [
          r.created_by,
          r.author_profile_id,
          ...(authorsByPost.get(r.id) ?? []).map((a) => a.profile_id),
        ].filter(Boolean) as string[];
        return authorIds.some((pid) => trusted.has(pid));
      });
    }
  }

  return rows.slice(0, limit).map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    cover_image_url: r.cover_image_url,
    cover_image_alt: r.cover_image_alt,
    author_name: r.author_name,
    published_at: r.published_at,
    authors: (authorsByPost.get(r.id) ?? []).map((a) => ({
      id: a.profile_id,
      username: a.profiles?.username ?? null,
      display_name: a.profiles?.display_name ?? null,
      avatar_url: a.profiles?.avatar_url ?? null,
      role_label: creditRole.get(a.profile_id) ?? a.role_label ?? null,
    })),
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
