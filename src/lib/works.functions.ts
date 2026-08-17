// Surviving Work-side server functions: portfolio pinning.
// Tools no longer live on Works — see src/lib/workshop-tools.functions.ts for the studio.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------- Portfolio pinning ---------------- */

const MAX_PINS = 6;

export const togglePinCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { creditId: string }) =>
    z.object({ creditId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: rErr } = await supabase
      .from("work_credits")
      .select("id,user_id,pinned_at")
      .eq("id", data.creditId)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row || row.user_id !== userId) throw new Error("Not your credit");

    if (row.pinned_at) {
      const { error } = await supabase
        .from("work_credits")
        .update({ pinned_at: null })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      return { pinned: false };
    }

    const [workRes, collabRes] = await Promise.all([
      supabase
        .from("work_credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("pinned_at", "is", null),
      supabase
        .from("collab_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("pinned_at", "is", null),
    ]);
    const total = (workRes.count ?? 0) + (collabRes.count ?? 0);
    if (total >= MAX_PINS) {
      throw new Error(`You can pin up to ${MAX_PINS} items. Unpin one first.`);
    }

    const { error } = await supabase
      .from("work_credits")
      .update({ pinned_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { pinned: true };
  });

export const getMyPinForWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) =>
    z.object({ workId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [credit, workTotal, collabTotal] = await Promise.all([
      supabase
        .from("work_credits")
        .select("id,pinned_at")
        .eq("work_id", data.workId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("work_credits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("pinned_at", "is", null),
      supabase
        .from("collab_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("pinned_at", "is", null),
    ]);
    return {
      creditId: credit.data?.id ?? null,
      pinned: !!credit.data?.pinned_at,
      totalPinned: (workTotal.count ?? 0) + (collabTotal.count ?? 0),
      maxPins: MAX_PINS,
    };
  });
