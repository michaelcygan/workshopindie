import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkCardData } from "@/components/work-card";
import type { Category } from "@/lib/categories";

const FilterSchema = z.object({
  limit: z.number().int().min(1).max(60).default(30),
  cursor: z.string().nullable().optional(),
  category: z.string().default("all"),
  city: z.string().default("all"), // city slug or "all"
  sort: z.enum(["recent", "trending"]).default("recent"),
  q: z.string().default(""),
});

export const listFollowingWorks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FilterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: follows, error: fErr } = await supabase
      .from("follows")
      .select("followed_user_id")
      .eq("follower_user_id", userId);
    if (fErr) throw new Error(fErr.message);
    const followedIds = (follows ?? []).map((f) => f.followed_user_id);
    if (followedIds.length === 0) {
      return { works: [] as WorkCardData[], nextCursor: null as string | null };
    }

    const { data: creditRows, error: cErr } = await supabase
      .from("work_credits")
      .select("work_id")
      .in("user_id", followedIds);
    if (cErr) throw new Error(cErr.message);
    const workIds = Array.from(new Set((creditRows ?? []).map((r) => r.work_id)));
    if (workIds.length === 0) {
      return { works: [] as WorkCardData[], nextCursor: null as string | null };
    }

    // Resolve city slug -> id (server-side)
    let cityId: string | null = null;
    if (data.city !== "all") {
      const { data: c } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", data.city)
        .maybeSingle();
      cityId = c?.id ?? null;
      if (!cityId) {
        return { works: [] as WorkCardData[], nextCursor: null as string | null };
      }
    }

    let q = supabase
      .from("works")
      .select(
        "id,title,slug,category,cover_url,cover_aspect,cover_focal_x,cover_focal_y,embed_url,source_type,like_count,save_count,view_count,published_at,popularity_score,created_at, work_credits(role_label, sort_order, display_name, profiles(id,display_name,username))",
      )
      .eq("status", "published")
      .in("visibility", ["public", "unlisted"])
      .in("id", workIds)
      .limit(data.limit);

    if (data.category !== "all") q = q.eq("category", data.category as Category);
    if (cityId) q = q.eq("city_id", cityId);
    if (data.q.trim()) {
      const s = data.q.trim().replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${s}%,excerpt.ilike.%${s}%`);
    }
    if (data.sort === "recent") {
      q = q
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (data.cursor) q = q.lt("published_at", data.cursor);
    } else {
      q = q
        .order("popularity_score", { ascending: false })
        .order("like_count", { ascending: false });
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    type Row = {
      id: string;
      title: string;
      slug: string;
      category: Category;
      cover_url: string | null;
      embed_url: string | null;
      source_type: string;
      like_count: number;
      save_count: number;
      view_count: number;
      published_at: string | null;
      work_credits?: {
        sort_order: number;
        display_name: string | null;
        profiles: { id: string; display_name: string | null; username: string | null } | null;
      }[];
    };
    const works = (rows as Row[]).map<WorkCardData>((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      category: r.category,
      cover_url: r.cover_url,
      embed_url: r.embed_url,
      source_type: r.source_type,
      like_count: r.like_count,
      save_count: r.save_count,
      view_count: r.view_count,
      credits: (r.work_credits ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((c) => ({
          id: c.profiles?.id ?? null,
          display_name: c.profiles?.display_name ?? c.display_name ?? null,
          username: c.profiles?.username ?? null,
        })),
    }));

    const last = (rows as Row[])[rows.length - 1];
    const nextCursor =
      data.sort === "recent" && rows.length === data.limit && last?.published_at
        ? last.published_at
        : null;

    return { works, nextCursor };
  });
