import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Single round-trip work peek: detail + creator + view-count bump.
 * Public read (uses admin client but scopes to published/public works only).
 */
export const getWorkPeekDetail = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ workId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: work, error } = await supabaseAdmin
      .from("works")
      .select(
        "id,title,slug,category,cover_url,excerpt,description,source_type,like_count,save_count,view_count,comment_count,created_by,status,visibility,creator:profiles!works_created_by_fkey(id,display_name,username,avatar_url)",
      )
      .eq("id", data.workId)
      .maybeSingle();
    if (error || !work) return { work: null, creator: null };
    if (work.status !== "published" || !["public", "unlisted"].includes(work.visibility)) {
      return { work: null, creator: null };
    }
    // Fire-and-forget view bump (don't block the response).
    supabaseAdmin
      .from("works")
      .update({ view_count: (work.view_count ?? 0) + 1 })
      .eq("id", work.id)
      .then(() => {});
    const { creator, ...rest } = work as typeof work & { creator: unknown };
    return { work: rest, creator: creator ?? null };
  });
