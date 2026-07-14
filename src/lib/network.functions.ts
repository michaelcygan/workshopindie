import { supabase } from "@/integrations/supabase/client";
import type { WorkCardData } from "@/components/work-card";
import type { Category } from "@/lib/categories";

/**
 * Network v1 — derived views over work_credits. No new tables.
 *
 * Everything here reads public data, so we run from the browser client
 * (RLS already scopes works to published+public). Server functions would
 * be overkill for read-only derived joins this small.
 */

type CreditRow = {
  user_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    headline: string | null;
  } | null;
};

/**
 * Works that share ≥2 credited people with the given work.
 * "These same humans also made this together." The first visible payoff
 * of the credit graph on a Work page.
 */
export async function getCoCreditedWorks(workId: string, currentCreatedBy: string): Promise<WorkCardData[]> {
  // 1) Who's credited on this work?
  const { data: creditRows } = await supabase
    .from("work_credits")
    .select("user_id")
    .eq("work_id", workId);
  const userIds = Array.from(
    new Set((creditRows ?? []).map((r) => r.user_id).filter((v): v is string => !!v)),
  );
  if (userIds.length < 2) return [];

  // 2) Find every other work any of these users are credited on.
  const { data: otherCredits } = await supabase
    .from("work_credits")
    .select("work_id, user_id")
    .in("user_id", userIds)
    .neq("work_id", workId);

  // 3) Count overlapping credited users per other_work; keep ones with ≥2.
  const overlap = new Map<string, Set<string>>();
  for (const row of otherCredits ?? []) {
    if (!row.user_id) continue;
    if (!overlap.has(row.work_id)) overlap.set(row.work_id, new Set());
    overlap.get(row.work_id)!.add(row.user_id);
  }
  const candidateIds = [...overlap.entries()]
    .filter(([, set]) => set.size >= 2)
    .map(([id]) => id);
  if (candidateIds.length === 0) return [];

  // 4) Hydrate those works.
  const { data: works } = await supabase
    .from("works")
    .select(
      "id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at, work_credits(role_label,sort_order,display_name, profiles(id,display_name,username))",
    )
    .in("id", candidateIds)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(6);

  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  return ((works ?? []) as Row[]).map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.profiles?.id ?? null,
        display_name: c.profiles?.display_name ?? c.display_name ?? null,
        username: c.profiles?.username ?? null,
      })),
  }));
}

export type Collaborator = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  shared_works: number;
};

/**
 * Top people the user has been co-credited with. Sorted by shared-work
 * count, capped at `limit`. The visible spine of the network on a profile.
 */
export async function getFrequentCollaborators(userId: string, limit = 8): Promise<Collaborator[]> {
  // Works this user is credited on
  const { data: myCredits } = await supabase
    .from("work_credits")
    .select("work_id")
    .eq("user_id", userId)
    .eq("hidden_from_profile", false);
  const workIds = Array.from(new Set((myCredits ?? []).map((r) => r.work_id)));
  if (workIds.length === 0) return [];

  // Co-credits on those works
  const { data: coCredits } = await supabase
    .from("work_credits")
    .select("user_id, work_id, profiles(id,display_name,username,avatar_url,headline)")
    .in("work_id", workIds)
    .neq("user_id", userId);

  const counts = new Map<string, { profile: NonNullable<CreditRow["profiles"]>; works: Set<string> }>();
  for (const row of (coCredits ?? []) as unknown as (CreditRow & { work_id: string })[]) {
    if (!row.profiles) continue;
    const existing = counts.get(row.user_id);
    if (existing) existing.works.add(row.work_id);
    else counts.set(row.user_id, { profile: row.profiles, works: new Set([row.work_id]) });
  }

  return [...counts.values()]
    .map((e) => ({ ...e.profile, shared_works: e.works.size }))
    .sort((a, b) => b.shared_works - a.shared_works)
    .slice(0, limit);
}

/**
 * "From your network" — newest published works by people the current user
 * has been co-credited with or follows.
 */
export async function getNetworkFeed(userId: string, limit = 8): Promise<WorkCardData[]> {
  const [collabs, { data: follows }] = await Promise.all([
    getFrequentCollaborators(userId, 50),
    supabase.from("follows").select("followed_user_id").eq("follower_user_id", userId),
  ]);
  const networkIds = new Set<string>(collabs.map((c) => c.id));
  for (const f of follows ?? []) networkIds.add(f.followed_user_id);
  networkIds.delete(userId);
  if (networkIds.size === 0) return [];

  // Pull works created_by anyone in network, newest first.
  const { data: works } = await supabase
    .from("works")
    .select(
      "id,title,slug,category,categories,cover_url,embed_url,source_type,like_count,save_count,view_count,published_at,created_at,created_by, work_credits(role_label,sort_order,display_name, profiles(id,display_name,username))",
    )
    .in("created_by", [...networkIds])
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  type Row = {
    id: string; title: string; slug: string; category: Category;
    cover_url: string | null; embed_url: string | null; source_type: string;
    like_count: number; save_count: number; view_count: number;
    work_credits?: { sort_order: number; display_name: string | null; profiles: { id: string; display_name: string | null; username: string | null } | null }[];
  };
  return ((works ?? []) as Row[]).map<WorkCardData>((r) => ({
    id: r.id, title: r.title, slug: r.slug, category: r.category,
    cover_url: r.cover_url, embed_url: r.embed_url, source_type: r.source_type,
    like_count: r.like_count, save_count: r.save_count, view_count: r.view_count,
    credits: (r.work_credits ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({
        id: c.profiles?.id ?? null,
        display_name: c.profiles?.display_name ?? c.display_name ?? null,
        username: c.profiles?.username ?? null,
      })),
  }));
}
