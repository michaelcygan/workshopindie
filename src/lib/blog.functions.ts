import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=600";

// ------------------------- helpers -------------------------

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

function slugifyTitle(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "post";
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  // Bounded loop — at worst try up to 50 variants.
  for (let i = 0; i < 50; i++) {
    let q = supabaseAdmin.from("blog_posts").select("id").eq("slug", candidate).limit(1);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${n++}`;
  }
  return `${base}-${Date.now()}`;
}

async function audit(action: string, targetId: string, payload: Record<string, unknown> = {}) {
  // Reuse admin-guarded RPC that stamps actor_user_id from auth.uid().
  const { supabase: _ } = { supabase: null };
  // We can't call the RPC via admin (bypasses auth.uid()). Direct insert via admin instead.
  await supabaseAdmin.from("admin_audit_log").insert({
    // actor_user_id filled by the handler that calls us via wrapper below
    action, target_type: "blog_post", target_id: targetId, payload,
    actor_user_id: (payload.__actor as string) ?? null,
  } as any);
}

// ------------------------- PUBLIC -------------------------

export const listPublishedPosts = createServerFn({ method: "GET" })
  .handler(async () => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at,updated_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPublishedPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id,title,slug,excerpt,body_markdown,cover_image_url,cover_image_alt,seo_title,seo_description,author_name,published_at,updated_at")
      .eq("slug", data.slug)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const getRelatedPosts = createServerFn({ method: "GET" })
  .inputValidator((d: { excludeId: string; limit?: number }) =>
    z.object({ excludeId: z.string().uuid(), limit: z.number().int().min(1).max(6).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: rows, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .neq("id", data.excludeId)
      .order("published_at", { ascending: false })
      .limit(data.limit ?? 3);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ------------------------- ADMIN -------------------------

export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id,title,slug,status,author_name,published_at,updated_at,created_at,cover_image_url")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

const writeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens").optional(),
  excerpt: z.string().trim().max(320).default(""),
  body_markdown: z.string().max(200_000).default(""),
  cover_image_url: z.string().trim().url().max(1000).nullable().optional(),
  cover_image_alt: z.string().trim().max(240).nullable().optional(),
  seo_title: z.string().trim().max(80).nullable().optional(),
  seo_description: z.string().trim().max(160).nullable().optional(),
  author_name: z.string().trim().min(1).max(120).default("Workshop"),
});

export const adminCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => writeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
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
        status: "draft",
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select("id,slug").single();
    if (error) throw new Error(error.message);
    await audit("blog_post.created", row.id, { __actor: context.userId, title: data.title });
    return row;
  });

export const adminUpdatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => writeSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("blog_posts").select("id,slug,published_at").eq("id", data.id).maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!existing) throw new Error("Not found");

    // Slug editable only while never-published.
    let slug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      if (existing.published_at) throw new Error("Slug is locked after publication.");
      slug = await uniqueSlug(slugifyTitle(data.slug), existing.id);
    }

    const { error } = await supabaseAdmin
      .from("blog_posts").update({
        title: data.title,
        slug,
        excerpt: data.excerpt,
        body_markdown: data.body_markdown,
        cover_image_url: data.cover_image_url ?? null,
        cover_image_alt: data.cover_image_alt ?? null,
        seo_title: data.seo_title ?? null,
        seo_description: data.seo_description ?? null,
        author_name: data.author_name,
        updated_by: context.userId,
      }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("blog_post.updated", data.id, { __actor: context.userId });
    return { id: data.id, slug };
  });

export const adminPublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: existing } = await supabaseAdmin
      .from("blog_posts").select("id,cover_image_url,cover_image_alt,title,excerpt").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");
    if (existing.cover_image_url && !existing.cover_image_alt?.trim()) {
      throw new Error("Add alt text for the cover image before publishing.");
    }
    if (!existing.title?.trim()) throw new Error("Title is required.");
    const { error } = await supabaseAdmin
      .from("blog_posts").update({ status: "published", updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("blog_post.published", data.id, { __actor: context.userId });
    return { ok: true };
  });

export const adminUnpublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("blog_posts").update({ status: "draft", updated_by: context.userId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("blog_post.unpublished", data.id, { __actor: context.userId });
    return { ok: true };
  });

export const adminDeleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: existing } = await supabaseAdmin
      .from("blog_posts").select("id,published_at,title").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");
    if (existing.published_at) throw new Error("Unpublish first; previously published posts cannot be deleted.");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit("blog_post.deleted", data.id, { __actor: context.userId, title: existing.title });
    return { ok: true };
  });
