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
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPublishedPostServer(slug: string) {
  const { data, error } = await publicClient()
    .from("blog_posts")
    .select("id,title,slug,excerpt,body_markdown,cover_image_url,cover_image_alt,seo_title,seo_description,author_name,published_at,updated_at,author_profile:profiles!blog_posts_author_profile_id_fkey(username,display_name,avatar_url)")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getRelatedPostsServer(excludeId: string, limit: number) {
  const { data, error } = await publicClient()
    .from("blog_posts")
    .select("id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at")
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .neq("id", excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminListPostsServer(context: AuthContext) {
  await requireAdmin(context);
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id,title,slug,status,author_name,published_at,updated_at,created_at,cover_image_url")
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
  return data;
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