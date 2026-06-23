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
