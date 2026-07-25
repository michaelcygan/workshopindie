import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { moderateFields } from "@/lib/moderation/service.server";

const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=600";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

type BlogWrite = {
  title: string;
  slug?: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  author_name: string;
  author_profile_username?: string | null;
};

function publicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Blog service is unavailable.");

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

async function requireAdmin(context: AuthContext) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

function slugifyTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "post";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let number = 2;
  for (let index = 0; index < 50; index += 1) {
    let query = supabaseAdmin.from("blog_posts").select("id").eq("slug", candidate).limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${number}`;
    number += 1;
  }
  return `${base}-${Date.now()}`;
}

async function resolveAuthorProfileId(username?: string | null) {
  const normalized = username?.trim().replace(/^@/, "").toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No Workshop profile found for @${normalized}.`);
  return data.id;
}

async function moderateBlogWrite(userId: string, data: BlogWrite) {
  await moderateFields(userId, "blog_post", {
    title: data.title,
    excerpt: data.excerpt,
    body: data.body_markdown,
    cover_alt: data.cover_image_alt,
    seo_title: data.seo_title,
    seo_description: data.seo_description,
    author_name: data.author_name,
  });
}

async function audit(action: string, targetId: string, actor: string, payload: Record<string, unknown> = {}) {
  await supabaseAdmin.from("admin_audit_log").insert({
    action,
    target_type: "blog_post",
    target_id: targetId,
    payload: JSON.parse(JSON.stringify(payload)),
    actor_user_id: actor,
  });
}

export function blogPublicCacheHeader() {
  return PUBLIC_CACHE;
}

export async function listPublishedPostsServer() {
  const { data, error } = await publicClient()
    .from("blog_posts")
    .select("id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at,updated_at")
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublishedPostServer(slug: string) {
  const { data, error } = await publicClient()
    .from("blog_posts")
    .select("id,title,slug,excerpt,body_markdown,cover_image_url,cover_image_alt,seo_title,seo_description,author_name,published_at,updated_at,show_in_blog_index,publication_type,author_profile:profiles!blog_posts_author_profile_id_fkey(username,display_name,avatar_url)")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: authorRows } = await publicClient()
    .from("blog_post_authors")
    .select("sort_order,role_label,profile:profiles!blog_post_authors_profile_id_fkey(id,username,display_name,avatar_url)")
    .eq("blog_post_id", data.id)
    .order("sort_order", { ascending: true });
  const authors = (authorRows ?? [])
    .map((r) => {
      const p = (r as { profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null }).profile;
      if (!p) return null;
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role_label: (r as { role_label: string | null }).role_label,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const { getBlogPostEntityTagsServer } = await import("./blog-entity-tags.server");
  const entity_tags = await getBlogPostEntityTagsServer(data.id, { publicOnly: true });
  return { ...data, authors, entity_tags };
}

export async function listProfileBlogPostsServer(profileId: string, cursor: { published_at: string; id: string } | null, limit: number) {
  const safeLimit = Math.min(Math.max(limit, 1), 24);
  const { data: attrRows, error: attrError } = await publicClient()
    .from("blog_post_authors")
    .select("blog_post_id")
    .eq("profile_id", profileId);
  if (attrError) throw new Error(attrError.message);
  const ids = Array.from(new Set((attrRows ?? []).map((r) => (r as { blog_post_id: string }).blog_post_id)));
  if (ids.length === 0) return { posts: [], nextCursor: null as { published_at: string; id: string } | null };

  let qb = publicClient()
    .from("blog_posts")
    .select("id,slug,title,excerpt,cover_image_url,cover_image_alt,published_at")
    .in("id", ids)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit + 1);

  if (cursor) {
    // Keyset: (published_at, id) < (cursor.published_at, cursor.id)
    qb = qb.or(
      `published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await qb;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; slug: string; title: string; excerpt: string; cover_image_url: string | null; cover_image_alt: string | null; published_at: string | null }>;
  const hasMore = rows.length > safeLimit;
  const posts = hasMore ? rows.slice(0, safeLimit) : rows;
  const last = posts[posts.length - 1];
  const nextCursor = hasMore && last?.published_at ? { published_at: last.published_at, id: last.id } : null;
  return { posts, nextCursor };
}

export async function listPostsByAuthorsServer(profileIds: string[], limit: number) {
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  const uniqueIds = Array.from(new Set(profileIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (uniqueIds.length === 0) return [];
  const client = publicClient();
  const { data: attrRows, error: attrErr } = await client
    .from("blog_post_authors")
    .select("blog_post_id,profile_id")
    .in("profile_id", uniqueIds);
  if (attrErr) throw new Error(attrErr.message);
  const idToAuthors = new Map<string, string[]>();
  for (const r of (attrRows ?? []) as Array<{ blog_post_id: string; profile_id: string }>) {
    const arr = idToAuthors.get(r.blog_post_id) ?? [];
    arr.push(r.profile_id);
    idToAuthors.set(r.blog_post_id, arr);
  }
  const postIds = Array.from(idToAuthors.keys());
  if (postIds.length === 0) return [];
  const { data, error } = await client
    .from("blog_posts")
    .select("id,slug,title,excerpt,cover_image_url,cover_image_alt,author_name,published_at")
    .in("id", postIds)
    .eq("status", "published")
    .eq("show_in_blog_index", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    author_name: string;
    published_at: string | null;
  }>).map((p) => ({ ...p, author_profile_ids: idToAuthors.get(p.id) ?? [] }));
}

export async function getRelatedPostsServer(excludeId: string, limit: number) {
  const { getRelatedPostsRankedServer } = await import("./blog-entity-tags.server");
  return getRelatedPostsRankedServer(excludeId, limit);
}

export async function adminListPostsServer(context: AuthContext) {
  await requireAdmin(context);
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id,title,slug,status,author_name,published_at,updated_at,created_at,cover_image_url,publication_type,show_in_blog_index,author_profile_id")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}


export async function adminListAuthorProfilesServer(context: AuthContext) {
  await requireAdmin(context);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .not("username", "is", null)
    .order("display_name", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminGetPostServer(context: AuthContext, id: string) {
  await requireAdmin(context);
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("*,author_profile:profiles!blog_posts_author_profile_id_fkey(username)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Not found");
  const { data: authorRows } = await supabaseAdmin
    .from("blog_post_authors")
    .select("sort_order,role_label,profile:profiles!blog_post_authors_profile_id_fkey(id,username,display_name,avatar_url)")
    .eq("blog_post_id", id)
    .order("sort_order", { ascending: true });
  const authors = (authorRows ?? [])
    .map((r) => {
      const p = (r as { profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null }).profile;
      if (!p) return null;
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role_label: (r as { role_label: string | null }).role_label,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  const { getBlogPostEntityTagsServer } = await import("./blog-entity-tags.server");
  const entity_tags = await getBlogPostEntityTagsServer(id, { publicOnly: false });
  return { ...data, authors, entity_tags };
}

export async function adminSearchAuthorProfilesServer(context: AuthContext, q: string) {
  await requireAdmin(context);
  const term = q.trim().replace(/^@/, "");
  let qb = supabaseAdmin
    .from("profiles")
    .select("id,username,display_name,avatar_url")
    .not("username", "is", null);
  if (term.length > 0) {
    const safe = term.replace(/[%,]/g, " ");
    qb = qb.or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`);
  }
  const { data, error } = await qb.order("display_name", { ascending: true }).limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminSetPostAuthorsServer(
  context: AuthContext,
  postId: string,
  authors: Array<{ profile_id: string; role_label?: string | null }>,
) {
  await requireAdmin(context);
  const { error: delError } = await supabaseAdmin
    .from("blog_post_authors")
    .delete()
    .eq("blog_post_id", postId);
  if (delError) throw new Error(delError.message);
  if (authors.length === 0) return { ok: true, count: 0 };
  const seen = new Set<string>();
  const rows = authors
    .filter((a) => {
      if (!a.profile_id || seen.has(a.profile_id)) return false;
      seen.add(a.profile_id);
      return true;
    })
    .map((a, index) => ({
      blog_post_id: postId,
      profile_id: a.profile_id,
      sort_order: index,
      role_label: a.role_label?.trim() ? a.role_label.trim().slice(0, 60) : null,
    }));
  if (rows.length === 0) return { ok: true, count: 0 };
  const { error } = await supabaseAdmin.from("blog_post_authors").insert(rows);
  if (error) throw new Error(error.message);
  await audit("blog_post.authors.set", postId, context.userId, { count: rows.length });
  return { ok: true, count: rows.length };
}

export async function adminCreateDraftServer(context: AuthContext, data: BlogWrite) {
  await requireAdmin(context);
  await moderateBlogWrite(context.userId, data);
  const authorProfileId = await resolveAuthorProfileId(data.author_profile_username);
  const base = data.slug ? slugifyTitle(data.slug) : slugifyTitle(data.title);
  const slug = await uniqueSlug(base);
  const { data: row, error } = await supabaseAdmin
    .from("blog_posts")
    .insert({
      title: data.title,
      slug,
      excerpt: data.excerpt,
      body_markdown: data.body_markdown,
      cover_image_url: data.cover_image_url ?? null,
      cover_image_alt: data.cover_image_alt ?? null,
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
      author_name: data.author_name,
      author_profile_id: authorProfileId,
      status: "draft",
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select("id,slug")
    .single();
  if (error) throw new Error(error.message);
  await audit("blog_post.created", row.id, context.userId, { title: data.title });
  return row;
}

export async function adminUpdatePostServer(context: AuthContext, data: BlogWrite & { id: string }) {
  await requireAdmin(context);
  await moderateBlogWrite(context.userId, data);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("blog_posts")
    .select("id,slug,published_at")
    .eq("id", data.id)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Not found");

  let slug = existing.slug;
  if (data.slug && data.slug !== existing.slug) {
    if (existing.published_at) throw new Error("Slug is locked after publication.");
    slug = await uniqueSlug(slugifyTitle(data.slug), existing.id);
  }
  const authorProfileId = await resolveAuthorProfileId(data.author_profile_username);
  const { error } = await supabaseAdmin
    .from("blog_posts")
    .update({
      title: data.title,
      slug,
      excerpt: data.excerpt,
      body_markdown: data.body_markdown,
      cover_image_url: data.cover_image_url ?? null,
      cover_image_alt: data.cover_image_alt ?? null,
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
      author_name: data.author_name,
      author_profile_id: authorProfileId,
      updated_by: context.userId,
    })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  await audit("blog_post.updated", data.id, context.userId);
  return { id: data.id, slug };
}

export async function adminPublishPostServer(context: AuthContext, id: string) {
  await requireAdmin(context);
  const { data: existing } = await supabaseAdmin
    .from("blog_posts")
    .select("id,cover_image_url,cover_image_alt,title")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Not found");
  if (existing.cover_image_url && !existing.cover_image_alt?.trim()) {
    throw new Error("Add alt text for the cover image before publishing.");
  }
  if (!existing.title?.trim()) throw new Error("Title is required.");
  const { assertTaggedEntitiesPubliclyVisibleServer } = await import("./blog-entity-tags.server");
  await assertTaggedEntitiesPubliclyVisibleServer(id);
  const { error } = await supabaseAdmin
    .from("blog_posts")
    .update({ status: "published", updated_by: context.userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit("blog_post.published", id, context.userId);
  return { ok: true };
}

export async function adminUnpublishPostServer(context: AuthContext, id: string) {
  await requireAdmin(context);
  const { error } = await supabaseAdmin
    .from("blog_posts")
    .update({ status: "draft", updated_by: context.userId })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit("blog_post.unpublished", id, context.userId);
  return { ok: true };
}

export async function adminDeleteDraftServer(context: AuthContext, id: string) {
  await requireAdmin(context);
  const { data: existing } = await supabaseAdmin
    .from("blog_posts")
    .select("id,published_at,title")
    .eq("id", id)
    .maybeSingle();
  if (!existing) throw new Error("Not found");
  if (existing.published_at) throw new Error("Unpublish first; previously published posts cannot be deleted.");
  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("blog_post.deleted", id, context.userId, { title: existing.title });
  return { ok: true };
}