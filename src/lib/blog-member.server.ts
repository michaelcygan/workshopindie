import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { moderateFields } from "@/lib/moderation/service.server";
import { resolveBlogAccess } from "@/lib/blog-access.server";

type AuthContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

const DASHBOARD_FIELDS =
  "id,title,slug,excerpt,status,publication_type,show_in_blog_index,cover_image_url,published_at,updated_at,created_at";

const EDITOR_FIELDS =
  "id,title,slug,excerpt,body_markdown,cover_image_url,cover_image_alt,seo_title,seo_description,status,publication_type,show_in_blog_index,published_at,updated_at,created_at,created_by,author_name";

// ---------- helpers ----------

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "post"
  );
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (let i = 0; i < 50; i += 1) {
    let q = supabaseAdmin.from("blog_posts").select("id").eq("slug", candidate).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
  return `${base}-${Date.now()}`;
}

async function assertOwner(postId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id,created_by,status,published_at,slug,publication_type")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Post not found.");
  if (data.created_by !== userId) throw new Error("Forbidden.");
  return data;
}

async function bumpRate(context: AuthContext, action: string, windowS: number, max: number) {
  const { data: ok } = await context.supabase.rpc("check_and_bump", {
    _action: action,
    _key: context.userId,
    _window_s: windowS,
    _max: max,
  });
  if (ok === false) throw new Error("You're doing that too fast. Try again shortly.");
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

async function authorNameFor(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name,username")
    .eq("id", userId)
    .maybeSingle();
  const name = data?.display_name?.trim() || data?.username?.trim() || "Workshop member";
  return name.slice(0, 120);
}

// Extract inline markdown image URLs and outbound links for validation.
function extractLinks(md: string) {
  const links: string[] = [];
  const images: string[] = [];
  const linkRe = /(?<!!)\[[^\]]*\]\(([^)\s]+)/g;
  const imgRe = /!\[[^\]]*\]\(([^)\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(md)) !== null) links.push(m[1]!);
  while ((m = imgRe.exec(md)) !== null) images.push(m[1]!);
  return { links, images };
}

function validateMemberContent(body: string) {
  const { links, images } = extractLinks(body);
  if (links.length > 20) throw new Error("Too many outbound links (max 20).");
  if (images.length > 12) throw new Error("Too many inline images (max 12).");
  for (const url of [...links, ...images]) {
    const lower = url.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
      throw new Error("Unsafe link protocol detected.");
    }
  }
  // Inline images must live on Workshop storage (covers/blog-images buckets).
  const supabaseHost = (process.env.SUPABASE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  for (const url of images) {
    if (!supabaseHost) continue;
    if (!url.includes(supabaseHost)) {
      throw new Error("Inline images must be uploaded through the editor.");
    }
  }
}

// ---------- server-only handlers ----------

export async function getMyBlogAccessServer(context: AuthContext) {
  return resolveBlogAccess(context.userId);
}

export async function listMyBlogPostsServer(
  context: AuthContext,
  cursor: { updated_at: string; id: string } | null,
  limit: number,
) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  let q = supabaseAdmin
    .from("blog_posts")
    .select(DASHBOARD_FIELDS)
    .eq("created_by", context.userId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit + 1);
  if (cursor) {
    q = q.or(
      `updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.lt.${cursor.id})`,
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; updated_at: string }>;
  const hasMore = rows.length > safeLimit;
  const posts = hasMore ? rows.slice(0, safeLimit) : rows;
  const last = posts[posts.length - 1];
  const nextCursor = hasMore && last ? { updated_at: last.updated_at, id: last.id } : null;
  return { posts, nextCursor };
}

export async function createMyBlogDraftServer(context: AuthContext) {
  const access = await resolveBlogAccess(context.userId);
  if (!access.canCreateDraft) throw new Error(access.reason ?? "Publishing is a Plus feature.");
  await bumpRate(context, "blog_member_draft_create", 3600, 10);

  // Enforce trial single-draft limit by returning the existing active draft.
  if (access.activeDraftLimit != null) {
    const { data: existing } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("created_by", context.userId)
      .eq("publication_type", "member")
      .eq("status", "draft")
      .is("published_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (existing && existing.length >= access.activeDraftLimit) {
      return { id: (existing[0] as { id: string }).id, reused: true };
    }
  }

  const name = await authorNameFor(context.userId);
  const { data, error } = await supabaseAdmin.rpc("create_member_blog_draft", {
    _user_id: context.userId,
    _author_name: name,
  });
  if (error) throw new Error(error.message);
  await audit("blog.member.draft_create", data as string, context.userId);
  return { id: data as string, reused: false };
}

export async function getMyBlogPostServer(context: AuthContext, id: string) {
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select(EDITOR_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Post not found.");
  if ((data as { created_by: string }).created_by !== context.userId) throw new Error("Forbidden.");
  const access = await resolveBlogAccess(context.userId);
  const { getBlogPostEntityTagsServer } = await import("./blog-entity-tags.server");
  const entity_tags = await getBlogPostEntityTagsServer(id, { publicOnly: false });
  return { post: data, access, entity_tags };
}

type MemberUpdateInput = {
  title?: string;
  slug?: string;
  excerpt?: string;
  body_markdown?: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  expected_updated_at?: string;
};

export async function updateMyBlogPostServer(context: AuthContext, id: string, input: MemberUpdateInput) {
  const current = await assertOwner(id, context.userId);
  const access = await resolveBlogAccess(context.userId);
  if (!access.canEditExisting) throw new Error(access.reason ?? "Editing is disabled.");

  // Optimistic concurrency
  if (input.expected_updated_at) {
    const { data: fresh } = await supabaseAdmin
      .from("blog_posts")
      .select("updated_at")
      .eq("id", id)
      .maybeSingle();
    const serverUpdated = (fresh as { updated_at: string } | null)?.updated_at;
    if (serverUpdated && serverUpdated !== input.expected_updated_at) {
      throw new Error("This post changed in another window. Reload to see the latest.");
    }
  }

  const patch: Record<string, unknown> = { updated_by: context.userId };

  if (input.title !== undefined) {
    const t = input.title.trim();
    if (!t || t.length > 160) throw new Error("Title must be 1–160 characters.");
    patch.title = t;
  }
  if (input.excerpt !== undefined) {
    const e = input.excerpt.trim();
    if (e.length > 320) throw new Error("Excerpt too long (max 320).");
    patch.excerpt = e;
  }
  if (input.body_markdown !== undefined) {
    validateMemberContent(input.body_markdown);
    patch.body_markdown = input.body_markdown;
  }
  if (input.cover_image_url !== undefined) patch.cover_image_url = input.cover_image_url;
  if (input.cover_image_alt !== undefined) {
    const alt = input.cover_image_alt?.trim() ?? null;
    if (alt && alt.length > 240) throw new Error("Cover alt text too long.");
    patch.cover_image_alt = alt;
  }
  if (input.seo_title !== undefined) {
    const s = input.seo_title?.trim() || null;
    if (s && s.length > 80) throw new Error("SEO title too long.");
    patch.seo_title = s;
  }
  if (input.seo_description !== undefined) {
    const s = input.seo_description?.trim() || null;
    if (s && s.length > 160) throw new Error("SEO description too long.");
    patch.seo_description = s;
  }

  // Slug editable only before first publish.
  if (input.slug !== undefined) {
    if (current.published_at) throw new Error("The URL is locked after first publish.");
    const clean = slugify(input.slug);
    if (!clean) throw new Error("Slug can't be empty.");
    patch.slug = await uniqueSlug(clean, id);
  }

  // If the post is currently published, moderate before saving.
  if (current.status === "published") {
    const name = await authorNameFor(context.userId);
    await moderateFields(context.userId, "blog_post", {
      title: (patch.title as string) ?? undefined,
      excerpt: (patch.excerpt as string) ?? undefined,
      body: (patch.body_markdown as string) ?? undefined,
      cover_alt: (patch.cover_image_alt as string | null) ?? undefined,
      seo_title: (patch.seo_title as string | null) ?? undefined,
      seo_description: (patch.seo_description as string | null) ?? undefined,
      author_name: name,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update(patch as never)
    .eq("id", id)
    .select(EDITOR_FIELDS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function publishMyBlogPostServer(context: AuthContext, id: string) {
  const current = await assertOwner(id, context.userId);
  const access = await resolveBlogAccess(context.userId);
  if (!access.canPublish) throw new Error(access.reason ?? "Publishing needs Plus.");
  await bumpRate(context, "blog_member_publish", 3600, 20);

  // Load full post to validate
  const { data: full, error: loadErr } = await supabaseAdmin
    .from("blog_posts")
    .select(EDITOR_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!full) throw new Error("Post not found.");
  const p = full as {
    title: string;
    slug: string;
    excerpt: string;
    body_markdown: string;
    cover_image_url: string | null;
    cover_image_alt: string | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  if (!p.title.trim() || p.title.trim().length < 3) throw new Error("Give your post a title before publishing.");
  if (!p.body_markdown.trim() || p.body_markdown.trim().length < 30) {
    throw new Error("Write a little more before publishing.");
  }
  if (p.cover_image_url && !p.cover_image_alt?.trim()) {
    throw new Error("Add alt text for the cover image before publishing.");
  }
  validateMemberContent(p.body_markdown);

  const name = await authorNameFor(context.userId);
  await moderateFields(context.userId, "blog_post", {
    title: p.title,
    excerpt: p.excerpt,
    body: p.body_markdown,
    cover_alt: p.cover_image_alt ?? undefined,
    seo_title: p.seo_title ?? undefined,
    seo_description: p.seo_description ?? undefined,
    author_name: name,
  });

  // If slug is still the placeholder, finalize it.
  let finalSlug = p.slug;
  if (finalSlug.startsWith("draft-") && !current.published_at) {
    finalSlug = await uniqueSlug(slugify(p.title));
  }

  // Ensure self-attribution.
  await supabaseAdmin
    .from("blog_post_authors")
    .upsert({ blog_post_id: id, profile_id: context.userId, sort_order: 0 }, { onConflict: "blog_post_id,profile_id" });

  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update({
      slug: finalSlug,
      status: "published",
      updated_by: context.userId,
      author_name: name,
    })
    .eq("id", id)
    .select(EDITOR_FIELDS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  await audit("blog.member.publish", id, context.userId, { slug: finalSlug });
  return data;
}

export async function unpublishMyBlogPostServer(context: AuthContext, id: string) {
  await assertOwner(id, context.userId);
  const access = await resolveBlogAccess(context.userId);
  if (!access.canUnpublish) throw new Error(access.reason ?? "You can't unpublish right now.");
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .update({ status: "draft", updated_by: context.userId })
    .eq("id", id)
    .select(EDITOR_FIELDS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  await audit("blog.member.unpublish", id, context.userId);
  return data;
}

export async function deleteMyBlogDraftServer(context: AuthContext, id: string) {
  const current = await assertOwner(id, context.userId);
  if (current.published_at) throw new Error("Published posts can only be unpublished, not deleted.");
  if (current.status !== "draft") throw new Error("Only drafts can be deleted.");
  const access = await resolveBlogAccess(context.userId);
  if (!access.canEditExisting) throw new Error(access.reason ?? "Your blogging access is inactive.");
  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit("blog.member.delete_draft", id, context.userId);
  return { ok: true };
}
