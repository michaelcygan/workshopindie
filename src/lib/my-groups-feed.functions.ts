import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyGroupsFeedItem = {
  id: string;
  kind: "collab" | "workshop";
  slug: string;
  title: string;
  subtitle: string | null;
  startsAt: string | null;
  group: { id: string; slug: string; name: string; accent_color: string | null };
};

type CollabRow = {
  collab_post_id: string;
  groups: { id: string; slug: string; name: string; accent_color: string | null; deleted_at: string | null } | null;
  collab_posts: { id: string; slug: string; title: string; description: string | null; status: string; resulting_work_id: string | null; created_at: string } | null;
};

type WorkshopRow = {
  workshop_id: string;
  groups: { id: string; slug: string; name: string; accent_color: string | null; deleted_at: string | null } | null;
  workshops: { id: string; slug: string; title: string; prompt: string | null; status: string; visibility: string; starts_at: string | null; ends_at: string | null } | null;
};

/**
 * Joinable opportunities (open collabs + upcoming/live workshops) drawn from
 * every group the caller belongs to. Used by the Groups index "From your
 * groups" shuffle card.
 */
export const listOpenForMyGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyGroupsFeedItem[]> => {
    const { supabase, userId } = context;
    const { data: mem } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    const ids = (mem ?? []).map((r) => r.group_id as string);
    if (ids.length === 0) return [];

    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: unknown[] | null }>;
        };
      };
    };

    const [collabsRes, workshopsRes] = await Promise.all([
      sb
        .from("group_collabs")
        .select(
          "collab_post_id,groups!inner(id,slug,name,accent_color,deleted_at),collab_posts!inner(id,slug,title,description,status,created_at)",
        )
        .in("group_id", ids),
      sb
        .from("group_workshops")
        .select(
          "workshop_id,groups!inner(id,slug,name,accent_color,deleted_at),workshops!inner(id,slug,title,prompt,status,visibility,starts_at,ends_at)",
        )
        .in("group_id", ids),
    ]);

    const items: MyGroupsFeedItem[] = [];
    const seen = new Set<string>();
    const nowMs = Date.now();

    for (const row of ((collabsRes.data ?? []) as unknown as CollabRow[])) {
      const g = row.groups;
      const c = row.collab_posts;
      if (!g || g.deleted_at || !c) continue;
      if (c.status !== "open") continue;
      const key = `collab:${c.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: c.id,
        kind: "collab",
        slug: c.slug,
        title: c.title,
        subtitle: (c.description ?? "").trim().split(/\n/)[0]?.slice(0, 140) || null,
        startsAt: c.created_at,
        group: { id: g.id, slug: g.slug, name: g.name, accent_color: g.accent_color },
      });
    }

    for (const row of ((workshopsRes.data ?? []) as unknown as WorkshopRow[])) {
      const g = row.groups;
      const w = row.workshops;
      if (!g || g.deleted_at || !w) continue;
      if (w.visibility !== "public") continue;
      if (w.status === "ended" || w.status === "archived" || w.status === "draft") continue;
      // Skip workshops whose end time has already passed.
      if (w.ends_at && new Date(w.ends_at).getTime() < nowMs) continue;
      const key = `workshop:${w.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: w.id,
        kind: "workshop",
        slug: w.slug,
        title: w.title,
        subtitle: w.prompt ? w.prompt.slice(0, 140) : null,
        startsAt: w.starts_at,
        group: { id: g.id, slug: g.slug, name: g.name, accent_color: g.accent_color },
      });
    }

    // Sort: workshops with upcoming starts_at first (sooner = higher), then
    // collabs by recency. Cap at 24.
    items.sort((a, b) => {
      const aT = a.kind === "workshop" && a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bT = b.kind === "workshop" && b.startsAt ? new Date(b.startsAt).getTime() : 0;
      if (aT && bT) return aT - bT;
      if (aT) return -1;
      if (bT) return 1;
      const aC = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const bC = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return bC - aC;
    });
    return items.slice(0, 24);
  });
