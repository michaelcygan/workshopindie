import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkCardData } from "@/components/work-card";
import type { Category } from "@/lib/categories";
import { canonicalFilterValues } from "@/lib/taxonomy";
import { WORK_CARD_SELECT, toWorkCard, type WorkCardRow } from "@/lib/work-card-query";

const FilterSchema = z.object({
  limit: z.number().int().min(1).max(60).default(30),
  cursor: z.string().nullable().optional(),
  category: z.string().default("all"),
  /** Category registry id, "all" for none. */
  kind: z.string().default("all"),
  /** Subject tag, "all" for none. */
  subject: z.string().default("all"),
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
      .select(`${WORK_CARD_SELECT},popularity_score`)
      .eq("status", "published")
      .in("visibility", ["public", "unlisted"])
      .in("id", workIds)
      .limit(data.limit);

    if (data.category !== "all")
      q = q.overlaps("categories_canonical", canonicalFilterValues(data.category));
    if (data.kind !== "all") q = q.eq("category_id", data.kind);
    if (data.subject !== "all") q = q.overlaps("subjects", [data.subject]);
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

    type Row = WorkCardRow;
    const works = ((rows ?? []) as unknown as Row[]).map<WorkCardData>(toWorkCard);

    const last = ((rows ?? []) as unknown as Row[])[(rows ?? []).length - 1];
    const nextCursor =
      data.sort === "recent" && rows.length === data.limit && last?.published_at
        ? last.published_at
        : null;

    return { works, nextCursor };
  });
