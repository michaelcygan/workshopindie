import { classificationEyebrow } from "@/lib/work-categories";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { BlogEntityKind, BlogEntityTag, BlogRailSubjectKind } from "@/lib/blog-entity-tags";
import { MAX_BLOG_ENTITY_TAGS } from "@/lib/blog-entity-tags";
import { makeEntityRef } from "@/lib/entities/kinds";
import {
  isWorkPubliclyReferenceable,
  isCollabPubliclyReferenceable,
  isGroupPubliclyReferenceable,
  isEventPubliclyReferenceable,
  isProfilePubliclyReferenceable,
  isBlogPostPubliclyReferenceable,
} from "@/lib/entities/visibility";

type Row = {
  work_id: string | null;
  collab_id: string | null;
  group_id: string | null;
  group_event_id: string | null;
  profile_id: string | null;
  related_blog_post_id: string | null;
  sort_order: number;
};

/** Columns every tag read selects. Keep in sync with `Row`. */
const TAG_COLUMNS =
  "work_id,collab_id,group_id,group_event_id,profile_id,related_blog_post_id,sort_order";

type EntityInput = { kind: BlogEntityKind; id: string };

async function resolveTags(rows: Row[], opts: { publicOnly: boolean }): Promise<BlogEntityTag[]> {
  const workIds = rows.map((r) => r.work_id).filter(Boolean) as string[];
  const collabIds = rows.map((r) => r.collab_id).filter(Boolean) as string[];
  const groupIds = rows.map((r) => r.group_id).filter(Boolean) as string[];
  const eventIds = rows.map((r) => r.group_event_id).filter(Boolean) as string[];
  const profileIds = rows.map((r) => r.profile_id).filter(Boolean) as string[];
  const relatedPostIds = rows.map((r) => r.related_blog_post_id).filter(Boolean) as string[];

  const [works, collabs, groups, events, profiles, workCredits, relatedPosts] = await Promise.all([
    workIds.length
      ? supabaseAdmin
          .from("works")
          .select(
            "id,slug,title,category,categories,category_id,category_canonical,categories_canonical,subjects,subcategories,subtype,excerpt,cover_url,cover_aspect,cover_focal_x,cover_focal_y,visibility,status",
          )
          .in("id", workIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            slug: string;
            title: string;
            category: string | null;
            categories: string[] | null;
            category_id: string | null;
            category_canonical: string | null;
            categories_canonical: string[] | null;
            subjects: string[] | null;
            subcategories: string[] | null;
            subtype: string | null;
            excerpt: string | null;
            cover_url: string | null;
            cover_aspect: string | null;
            cover_focal_x: number | null;
            cover_focal_y: number | null;
            visibility: string;
            status: string;
          }>,
        }),

    collabIds.length
      ? supabaseAdmin
          .from("collab_posts")
          .select("id,slug,title,description,status,archived_at,resulting_work_id")
          .in("id", collabIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            slug: string;
            title: string;
            description: string | null;
            status: string;
            archived_at: string | null;
            resulting_work_id: string | null;
          }>,
        }),
    groupIds.length
      ? supabaseAdmin
          .from("groups")
          .select("id,slug,name,tagline,avatar_url,visibility,deleted_at")
          .in("id", groupIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            slug: string;
            name: string;
            tagline: string | null;
            avatar_url: string | null;
            visibility: string;
            deleted_at: string | null;
          }>,
        }),
    eventIds.length
      ? supabaseAdmin
          .from("group_events")
          .select(
            "id,slug,title,tagline,cover_url,starts_at,visibility,deleted_at,group:groups!group_events_group_id_fkey(slug,name,visibility,deleted_at)",
          )
          .in("id", eventIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            slug: string;
            title: string;
            tagline: string | null;
            cover_url: string | null;
            starts_at: string;
            visibility: string;
            deleted_at: string | null;
            group: {
              slug: string;
              name: string;
              visibility: string;
              deleted_at: string | null;
            } | null;
          }>,
        }),
    profileIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id,username,display_name,avatar_url,headline,discoverable")
          .in("id", profileIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            username: string | null;
            display_name: string | null;
            avatar_url: string | null;
            headline: string | null;
            discoverable: boolean;
          }>,
        }),
    workIds.length
      ? supabaseAdmin
          .from("work_credits")
          .select(
            "work_id,user_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)",
          )
          .in("work_id", workIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({
          data: [] as Array<{
            work_id: string;
            user_id: string | null;
            role_label: string | null;
            profiles: {
              id: string;
              username: string | null;
              display_name: string | null;
              avatar_url: string | null;
            } | null;
          }>,
        }),
    // One batched read for every connected Blog post — never one per row.
    relatedPostIds.length
      ? supabaseAdmin
          .from("blog_posts")
          .select(
            "id,slug,title,excerpt,cover_image_url,author_name,published_at,status,show_in_blog_index",
          )
          .in("id", relatedPostIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            slug: string;
            title: string;
            excerpt: string | null;
            cover_image_url: string | null;
            author_name: string | null;
            published_at: string | null;
            status: string;
            show_in_blog_index: boolean | null;
          }>,
        }),
  ]);

  const workMap = new Map((works.data ?? []).map((w) => [w.id, w]));
  const collabMap = new Map((collabs.data ?? []).map((c) => [c.id, c]));
  const groupMap = new Map((groups.data ?? []).map((g) => [g.id, g]));
  const eventMap = new Map((events.data ?? []).map((e) => [e.id, e]));
  const profileMap = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const relatedPostMap = new Map((relatedPosts.data ?? []).map((p) => [p.id, p]));

  type CreditRow = {
    work_id: string;
    user_id: string | null;
    role_label: string | null;
    profiles: {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  const creditsByWork = new Map<string, CreditRow[]>();
  for (const c of (workCredits.data ?? []) as unknown as CreditRow[]) {
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
        ...makeEntityRef(
          { kind: "work", slug: w.slug },
          {
            id: w.id,
            label: w.title,
            image: w.cover_url,
            sublabel: w.category ? w.category.charAt(0).toUpperCase() + w.category.slice(1) : null,
          },
        ),
        sublabel: w.category ? w.category.charAt(0).toUpperCase() + w.category.slice(1) : null,
        image: w.cover_url,
        work: isPublic
          ? {
              excerpt: w.excerpt ?? null,
              categories: (w.categories ?? []).length
                ? (w.categories as string[])
                : w.category
                  ? [w.category]
                  : [],
              subtype: w.subtype ?? null,
              // Gallery's finalized classification: CATEGORY · PRIMARY FIELD.
              eyebrow: classificationEyebrow(w),
              subjects: (w.subjects ?? []).filter(Boolean) as string[],
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
      out.push({
        ...makeEntityRef({ kind: "collab", slug: c.slug }, { id: c.id, label: c.title }),
        sublabel: c.description ?? null,
        image: null,
      });
      continue;
    }
    if (r.group_id) {
      const g = groupMap.get(r.group_id);
      if (!g) continue;
      if (opts.publicOnly && !isGroupPubliclyReferenceable(g)) continue;
      out.push({
        ...makeEntityRef({ kind: "group", slug: g.slug }, { id: g.id, label: g.name }),
        sublabel: g.tagline ?? null,
        image: g.avatar_url,
      });
      continue;
    }
    if (r.group_event_id) {
      const e = eventMap.get(r.group_event_id);
      if (!e || !e.group?.slug) continue;
      if (opts.publicOnly && !isEventPubliclyReferenceable(e, e.group)) continue;
      out.push({
        ...makeEntityRef(
          { kind: "event", slug: e.slug, groupSlug: e.group.slug },
          { id: e.id, label: e.title },
        ),
        sublabel: e.group.name,
        image: e.cover_url,
      });
      continue;
    }
    if (r.profile_id) {
      const p = profileMap.get(r.profile_id);
      if (!p || !p.username) continue;
      if (opts.publicOnly && !isProfilePubliclyReferenceable(p)) continue;
      out.push({
        ...makeEntityRef(
          { kind: "profile", username: p.username },
          { id: p.id, label: p.display_name || p.username },
        ),
        sublabel: p.headline ?? `@${p.username}`,
        image: p.avatar_url,
      });
      continue;
    }
    if (r.related_blog_post_id) {
      const post = relatedPostMap.get(r.related_blog_post_id);
      if (!post) continue;
      const isPublic = isBlogPostPubliclyReferenceable(post);
      if (opts.publicOnly && !isPublic) continue;
      out.push({
        ...makeEntityRef(
          { kind: "post", slug: post.slug },
          { id: post.id, label: post.title, image: post.cover_image_url },
        ),
        sublabel: post.author_name ?? null,
        image: post.cover_image_url,
        post: {
          excerpt: post.excerpt ?? null,
          cover_url: post.cover_image_url ?? null,
          author_name: post.author_name ?? null,
          published_at: post.published_at ?? null,
        },
      });
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
    .select(TAG_COLUMNS)
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
    .select(`blog_post_id,${TAG_COLUMNS}`)
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
  const byKind: Record<BlogEntityKind, string[]> = {
    work: [],
    collab: [],
    group: [],
    event: [],
    profile: [],
    post: [],
  };
  for (const t of inputs) byKind[t.kind].push(t.id);

  const checks: Array<PromiseLike<{ kind: BlogEntityKind; found: Set<string> }>> = [];
  if (byKind.work.length) {
    checks.push(
      supabaseAdmin
        .from("works")
        .select("id")
        .in("id", byKind.work)
        .then(({ data }) => ({
          kind: "work" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
  }
  if (byKind.collab.length) {
    checks.push(
      supabaseAdmin
        .from("collab_posts")
        .select("id")
        .in("id", byKind.collab)
        .then(({ data }) => ({
          kind: "collab" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
  }
  if (byKind.group.length) {
    checks.push(
      supabaseAdmin
        .from("groups")
        .select("id")
        .in("id", byKind.group)
        .then(({ data }) => ({
          kind: "group" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
  }
  if (byKind.event.length) {
    checks.push(
      supabaseAdmin
        .from("group_events")
        .select("id")
        .in("id", byKind.event)
        .then(({ data }) => ({
          kind: "event" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
  }
  if (byKind.profile.length) {
    checks.push(
      supabaseAdmin
        .from("profiles")
        .select("id")
        .in("id", byKind.profile)
        .then(({ data }) => ({
          kind: "profile" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
  }
  if (byKind.post.length) {
    checks.push(
      supabaseAdmin
        .from("blog_posts")
        .select("id")
        .in("id", byKind.post)
        .then(({ data }) => ({
          kind: "post" as BlogEntityKind,
          found: new Set((data ?? []).map((r) => r.id)),
        })),
    );
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
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
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
    .select(TAG_COLUMNS)
    .eq("blog_post_id", postId)
    .order("sort_order", { ascending: true });
  const publicTags = await resolveTags((rows.data ?? []) as Row[], { publicOnly: true });
  const allTags = await resolveTags((rows.data ?? []) as Row[], { publicOnly: false });
  if (publicTags.length < allTags.length) {
    throw new Error(
      "One of the entities connected to this post is no longer public. Remove it before publishing.",
    );
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
    related_blog_post_id: kind === "post" ? entityId : null,
    sort_order: 0,
  };
  const tags = await resolveTags([row], { publicOnly: true });
  return tags.length > 0;
}

/**
 * Who is allowed to speak *for* an entity on the entity's own page.
 *
 * Anyone can tag a Work, Collab, Group, Event or person in their post — that is
 * the point of the Blog graph. But an object's own page carries that object's
 * authority, so the reverse rail only echoes stories written by the people
 * actually behind it. Untrusted posts are never hidden from the Blog itself;
 * they just don't get to appear as the object's own account of itself.
 *
 * Workshop editorial posts bypass this entirely (handled by the caller).
 */
export async function resolveTrustedAuthorIds(
  kind: BlogRailSubjectKind,
  entityId: string,
): Promise<{ trusted: Set<string>; creditRole: Map<string, string> }> {
  const trusted = new Set<string>();
  const creditRole = new Map<string, string>();
  const add = (id: string | null | undefined) => {
    if (id) trusted.add(id);
  };

  if (kind === "work") {
    // Creator + credited collaborators. Credits also supply role labels.
    const [{ data: work }, { data: creditRows }] = await Promise.all([
      supabaseAdmin.from("works").select("created_by").eq("id", entityId).maybeSingle(),
      supabaseAdmin.from("work_credits").select("user_id,role_label").eq("work_id", entityId),
    ]);
    add((work as { created_by: string | null } | null)?.created_by ?? null);
    for (const c of (creditRows ?? []) as Array<{
      user_id: string | null;
      role_label: string | null;
    }>) {
      if (!c.user_id) continue;
      trusted.add(c.user_id);
      if (c.role_label) creditRole.set(c.user_id, c.role_label);
    }
    return { trusted, creditRole };
  }

  if (kind === "collab") {
    // Owner + everyone who actually joined.
    const [{ data: collab }, { data: invites }] = await Promise.all([
      supabaseAdmin.from("collab_posts").select("user_id").eq("id", entityId).maybeSingle(),
      supabaseAdmin
        .from("collab_invites")
        .select("invitee_user_id")
        .eq("collab_post_id", entityId)
        .eq("status", "accepted"),
    ]);
    add((collab as { user_id: string | null } | null)?.user_id ?? null);
    for (const i of (invites ?? []) as Array<{ invitee_user_id: string | null }>)
      add(i.invitee_user_id);
    return { trusted, creditRole };
  }

  if (kind === "event") {
    // Organizer + co-hosts, plus the parent group's stewards.
    const { data: ev } = await supabaseAdmin
      .from("group_events")
      .select("created_by,group_id")
      .eq("id", entityId)
      .maybeSingle();
    const row = ev as { created_by: string | null; group_id: string | null } | null;
    add(row?.created_by ?? null);
    const [{ data: cohosts }, stewards] = await Promise.all([
      supabaseAdmin.from("group_event_cohosts").select("user_id").eq("event_id", entityId),
      row?.group_id ? resolveTrustedAuthorIds("group", row.group_id) : null,
    ]);
    for (const c of (cohosts ?? []) as Array<{ user_id: string | null }>) add(c.user_id);
    for (const id of stewards?.trusted ?? []) trusted.add(id);
    return { trusted, creditRole };
  }

  if (kind === "group") {
    const [{ data: group }, { data: members }] = await Promise.all([
      supabaseAdmin.from("groups").select("created_by").eq("id", entityId).maybeSingle(),
      supabaseAdmin
        .from("group_members")
        .select("user_id,role")
        .eq("group_id", entityId)
        .in("role", ["steward", "owner"]),
    ]);
    add((group as { created_by: string | null } | null)?.created_by ?? null);
    for (const m of (members ?? []) as Array<{ user_id: string | null }>) add(m.user_id);
    return { trusted, creditRole };
  }

  // Profile: only the person themselves speaks for their own page.
  add(entityId);
  return { trusted, creditRole };
}

/**
 * Reverse discovery: recently-published blog posts tagged with a given entity.
 *
 * `trustedOnly` narrows the rail to stories written by the people behind the
 * entity (see `resolveTrustedAuthorIds`) plus Workshop editorial. It applies to
 * every kind — Works, Collabs, Groups, Events and profiles alike.
 */
export async function listBlogPostsForEntityServer(
  kind: BlogRailSubjectKind,
  entityId: string,
  limit = 3,
  opts: { trustedOnly?: boolean } = {},
): Promise<PublicPostSummary[]> {
  const column: Record<BlogRailSubjectKind, string> = {
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
  const idSet = new Set((tagRows ?? []).map((r) => (r as { blog_post_id: string }).blog_post_id));

  // A person's own page also carries the stories they wrote — tagging yourself
  // in your own post is not something anyone remembers to do.
  if (kind === "profile") {
    const [{ data: ownRows }, { data: bylineRows }] = await Promise.all([
      supabaseAdmin
        .from("blog_posts")
        .select("id")
        .or(`created_by.eq.${entityId},author_profile_id.eq.${entityId}`),
      supabaseAdmin.from("blog_post_authors").select("blog_post_id").eq("profile_id", entityId),
    ]);
    for (const r of (ownRows ?? []) as Array<{ id: string }>) idSet.add(r.id);
    for (const r of (bylineRows ?? []) as Array<{ blog_post_id: string }>)
      idSet.add(r.blog_post_id);
  }

  const postIds = Array.from(idSet);
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
    .select(
      "blog_post_id,profile_id,role_label,sort_order,profiles(id,username,display_name,avatar_url)",
    )
    .in(
      "blog_post_id",
      rows.map((r) => r.id),
    )
    .order("sort_order", { ascending: true });
  type AuthorRow = {
    blog_post_id: string;
    profile_id: string;
    role_label: string | null;
    profiles: {
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };
  const authorsByPost = new Map<string, AuthorRow[]>();
  for (const a of (authorRows ?? []) as unknown as AuthorRow[]) {
    const arr = authorsByPost.get(a.blog_post_id) ?? [];
    arr.push(a);
    authorsByPost.set(a.blog_post_id, arr);
  }

  // Trusted-context filter (every kind) + credit-aware role labels for Works.
  let creditRole = new Map<string, string>();
  if (kind === "work" || opts.trustedOnly) {
    const resolved = await resolveTrustedAuthorIds(kind, entityId);
    creditRole = resolved.creditRole;
    if (opts.trustedOnly) {
      rows = rows.filter((r) => {
        if (r.publication_type && r.publication_type !== "member") return true; // editorial / admin
        const authorIds = [
          r.created_by,
          r.author_profile_id,
          ...(authorsByPost.get(r.id) ?? []).map((a) => a.profile_id),
        ].filter(Boolean) as string[];
        return authorIds.some((pid) => resolved.trusted.has(pid));
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
export async function getRelatedPostsRankedServer(
  postId: string,
  limit: number,
): Promise<PublicPostSummary[]> {
  // 1) Find this post's tagged entities.
  const { data: myRows } = await supabaseAdmin
    .from("blog_post_entity_tags")
    .select(TAG_COLUMNS)
    .eq("blog_post_id", postId);

  const workIds: string[] = [];
  const collabIds: string[] = [];
  const groupIds: string[] = [];
  const eventIds: string[] = [];
  const profileIds: string[] = [];
  // Author-chosen "Related posts" must never repeat inside the algorithmic
  // "More from the blog" list.
  const manualPostIds: string[] = [];
  for (const r of (myRows ?? []) as Row[]) {
    if (r.work_id) workIds.push(r.work_id);
    if (r.collab_id) collabIds.push(r.collab_id);
    if (r.group_id) groupIds.push(r.group_id);
    if (r.group_event_id) eventIds.push(r.group_event_id);
    if (r.profile_id) profileIds.push(r.profile_id);
    if (r.related_blog_post_id) manualPostIds.push(r.related_blog_post_id);
  }
  const manualSet = new Set(manualPostIds);

  const overlap = new Map<string, number>(); // post_id -> shared-entity count
  if (
    workIds.length ||
    collabIds.length ||
    groupIds.length ||
    eventIds.length ||
    profileIds.length
  ) {
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
      if (r.blog_post_id === postId || manualSet.has(r.blog_post_id)) continue;
      overlap.set(r.blog_post_id, (overlap.get(r.blog_post_id) ?? 0) + 1);
    }
  }

  const rankedIds = [...overlap.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const out: PublicPostSummary[] = [];
  if (rankedIds.length) {
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index",
      )
      .in("id", rankedIds.slice(0, limit * 2))
      .eq("status", "published")
      .eq("show_in_blog_index", true)
      .lte("published_at", new Date().toISOString());
    const byId = new Map(
      (data ?? []).map((r) => [(r as PublicPostSummary).id, r as PublicPostSummary]),
    );
    for (const id of rankedIds) {
      const row = byId.get(id);
      if (row) out.push(row);
      if (out.length >= limit) break;
    }
  }

  if (out.length < limit) {
    const excludeIds = [postId, ...manualPostIds, ...out.map((p) => p.id)];
    const { data } = await supabaseAdmin
      .from("blog_posts")
      .select(
        "id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at,status,show_in_blog_index",
      )
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
