import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const PUBLIC_CACHE = "public, s-maxage=30, stale-while-revalidate=300";

export type BlogSearchHit = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  published_at: string | null;
  category_slug?: string | null;
  fields?: string[] | null;
  subjects?: string[] | null;
  story_type?: string | null;
  story_types?: string[] | null;
};

/** Typeahead over published Blog posts: title first, then excerpt. */
export const searchBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({ q: z.string().max(120).default(""), limit: z.number().int().min(1).max(12).optional() })
      .parse(d),
  )
  .handler(async ({ data }): Promise<BlogSearchHit[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    setResponseHeader("cache-control", PUBLIC_CACHE);

    const { topicsPublicClient } = await import("./topics/topics.server");
    const { BLOG_RAIL_COLUMNS } = await import("./blog-select");

    // PostgREST `or` splits on commas and parens, so keep the needle simple.
    const safe = q.replace(/[,()%*]/g, " ").trim();
    if (!safe) return [];

    const { data: rows, error } = await topicsPublicClient()
      .from("blog_posts")
      .select(BLOG_RAIL_COLUMNS)
      .eq("status", "published")
      .eq("show_in_blog_index", true)
      .lte("published_at", new Date().toISOString())
      .or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`)
      .order("published_at", { ascending: false })
      .limit(data.limit ?? 8);

    if (error) return [];
    const hits = (rows ?? []) as unknown as BlogSearchHit[];
    const needle = safe.toLowerCase();
    // Title matches read as better answers than body matches.
    return hits.sort((a, b) => {
      const at = a.title.toLowerCase().includes(needle) ? 0 : 1;
      const bt = b.title.toLowerCase().includes(needle) ? 0 : 1;
      return at - bt;
    });
  });
