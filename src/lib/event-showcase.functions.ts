import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type Bringer = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export type ShowcaseEntry = {
  kind: "work" | "collab";
  item_id: string;
  title: string;
  slug: string | null;
  cover_url: string | null;
  owner: Bringer | null;
  bringers: Bringer[];
};

// Public: list showcase items grouped by underlying work/collab,
// with stacked-avatar `bringers` arrays. Visible to everyone.
export const listEventShowcase = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<ShowcaseEntry[]> => {
    const supabase = publicClient();
    const { data: rows, error } = await supabase
      .from("event_showcase_items")
      .select(
        "id,user_id,work_id,collab_id,created_at," +
          "work:works(id,title,slug,cover_url,visibility,status,created_by," +
          "author:profiles!works_created_by_fkey(display_name,username,avatar_url))," +
          "collab:collab_posts(id,title,slug,status,user_id," +
          "owner:profiles!collab_posts_user_id_fkey(display_name,username,avatar_url))",
      )
      .eq("event_id", data.event_id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    type R = {
      user_id: string;
      work_id: string | null;
      collab_id: string | null;
      work: {
        id: string; title: string; slug: string | null; cover_url: string | null;
        visibility: string; status: string; created_by: string;
        author: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
      } | null;
      collab: {
        id: string; title: string; slug: string | null; status: string; user_id: string;
        owner: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
      } | null;
    };

    const raw = (rows ?? []) as unknown as R[];
    // Fetch bringer profiles in one batch
    const bringerIds = Array.from(new Set(raw.map((r) => r.user_id)));
    const bringerMap = new Map<string, Bringer>();
    if (bringerIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", bringerIds);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; username: string | null; avatar_url: string | null }>) {
        bringerMap.set(p.id, {
          user_id: p.id,
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
        });
      }
    }

    const groups = new Map<string, ShowcaseEntry>();
    for (const r of raw) {
      let key: string | null = null;
      let entry: Omit<ShowcaseEntry, "bringers"> | null = null;
      if (r.work_id && r.work) {
        if (r.work.visibility !== "public" || r.work.status !== "published") continue;
        key = `w:${r.work_id}`;
        entry = {
          kind: "work",
          item_id: r.work.id,
          title: r.work.title,
          slug: r.work.slug,
          cover_url: r.work.cover_url,
          owner: r.work.author ? { user_id: r.work.created_by, ...r.work.author } : null,
        };
      } else if (r.collab_id && r.collab) {
        if (r.collab.status !== "open") continue;
        key = `c:${r.collab_id}`;
        entry = {
          kind: "collab",
          item_id: r.collab.id,
          title: r.collab.title,
          slug: r.collab.slug,
          cover_url: null,
          owner: r.collab.owner ? { user_id: r.collab.user_id, ...r.collab.owner } : null,
        };
      }
      if (!key || !entry) continue;

      const bringer = bringerMap.get(r.user_id) ?? {
        user_id: r.user_id, display_name: null, username: null, avatar_url: null,
      };
      const existing = groups.get(key);
      if (existing) {
        if (!existing.bringers.some((b) => b.user_id === bringer.user_id)) {
          existing.bringers.push(bringer);
        }
      } else {
        groups.set(key, { ...entry, bringers: [bringer] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.bringers.length - a.bringers.length);
  });

const addSchema = z.object({
  event_id: z.string().uuid(),
  work_id: z.string().uuid().optional(),
  collab_id: z.string().uuid().optional(),
  note: z.string().max(140).optional(),
});

export const addShowcaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (!data.work_id && !data.collab_id) {
      throw new Error("Pick a work or a collab.");
    }
    if (data.work_id && data.collab_id) {
      throw new Error("Pick one: work or collab.");
    }
    const { supabase, userId } = context;
    const { error } = await supabase.from("event_showcase_items").insert({
      event_id: data.event_id,
      user_id: userId,
      work_id: data.work_id ?? null,
      collab_id: data.collab_id ?? null,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeShowcaseItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      event_id: z.string().uuid(),
      work_id: z.string().uuid().optional(),
      collab_id: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("event_showcase_items")
      .delete()
      .eq("event_id", data.event_id)
      .eq("user_id", userId);
    if (data.work_id) q = q.eq("work_id", data.work_id);
    if (data.collab_id) q = q.eq("collab_id", data.collab_id);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// What can the current user "bring"? Their published public works + their open collabs.
export const listMyShowcaseCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [worksRes, collabsRes, mineRes] = await Promise.all([
      supabase
        .from("works")
        .select("id,title,slug,cover_url")
        .eq("created_by", userId)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(20),
      supabase
        .from("collab_posts")
        .select("id,title,slug")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("event_showcase_items")
        .select("work_id,collab_id")
        .eq("event_id", data.event_id)
        .eq("user_id", userId),
    ]);

    const broughtWorks = new Set((mineRes.data ?? []).map((r) => r.work_id).filter(Boolean) as string[]);
    const broughtCollabs = new Set((mineRes.data ?? []).map((r) => r.collab_id).filter(Boolean) as string[]);

    return {
      works: (worksRes.data ?? []).map((w) => ({ ...w, brought: broughtWorks.has(w.id) })),
      collabs: (collabsRes.data ?? []).map((c) => ({ ...c, brought: broughtCollabs.has(c.id) })),
    };
  });
