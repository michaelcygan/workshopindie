import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type WorkProvenance = {
  collab: { id: string; slug: string; title: string } | null;
  workshop: { id: string; slug: string; title: string } | null;
};

/**
 * Lightweight read of the source rows behind a work, for the credit layer's
 * provenance chips. Safe public read — only slug+title, no protected fields.
 * Returns nulls on any failure so the layer never blanks the page.
 */
export const getWorkProvenance = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ work_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<WorkProvenance> => {
    const empty: WorkProvenance = { collab: null, workshop: null };
    try {
      const sb = publicClient();
      const { data: w } = await sb
        .from("works")
        .select("source_collab_post_id, source_workshop_id, visibility")
        .eq("id", data.work_id)
        .maybeSingle();
      if (!w || w.visibility !== "public") return empty;

      const [collabRes, wsRes] = await Promise.all([
        w.source_collab_post_id
          ? sb
              .from("collab_posts")
              .select("id, slug, title, status")
              .eq("id", w.source_collab_post_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        w.source_workshop_id
          ? sb
              .from("workshops")
              .select("id, slug, title")
              .eq("id", w.source_workshop_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        collab: collabRes.data
          ? { id: collabRes.data.id, slug: collabRes.data.slug, title: collabRes.data.title }
          : null,
        workshop: wsRes.data
          ? { id: wsRes.data.id, slug: wsRes.data.slug, title: wsRes.data.title }
          : null,
      };
    } catch {
      return empty;
    }
  });

export type WorkFromSource = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  created_by: string;
  author: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

/**
 * Reverse provenance: list public Works that were born from a given Workshop
 * or Collab post. Used by the "Works born here" rails on `/workshops/$slug`
 * and `/collab/$slug`. Returns [] on any failure so the page never blanks.
 */
export const getWorksBySource = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    z
      .object({
        workshop_id: z.string().uuid().optional(),
        collab_post_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(24).optional(),
      })
      .refine((v) => !!(v.workshop_id || v.collab_post_id), { message: "source required" })
      .parse(i),
  )
  .handler(async ({ data }): Promise<WorkFromSource[]> => {
    try {
      const sb = publicClient();
      let q = sb
        .from("works")
        .select(
          "id, slug, title, excerpt, cover_url, published_at, created_by, visibility, profiles:profiles!works_created_by_fkey(display_name, username, avatar_url)",
        )
        .eq("visibility", "public")
        .not("published_at", "is", null)
        .order("published_at", { ascending: false })
        .limit(data.limit ?? 12);
      if (data.workshop_id) q = q.eq("source_workshop_id", data.workshop_id);
      if (data.collab_post_id) q = q.eq("source_collab_post_id", data.collab_post_id);
      const { data: rows } = await q;
      type Row = {
        id: string; slug: string; title: string; excerpt: string | null;
        cover_url: string | null; published_at: string | null; created_by: string;
        profiles: { display_name: string | null; username: string | null; avatar_url: string | null }
          | { display_name: string | null; username: string | null; avatar_url: string | null }[] | null;
      };
      return ((rows ?? []) as unknown as Row[]).map((r) => ({
        id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
        cover_url: r.cover_url, published_at: r.published_at, created_by: r.created_by,
        author: Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : r.profiles,
      }));
    } catch {
      return [];
    }
  });
