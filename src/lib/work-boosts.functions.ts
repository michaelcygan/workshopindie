import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { workId: string };

function validate(input: Input) {
  if (!input?.workId || typeof input.workId !== "string") {
    throw new Error("workId required");
  }
  return input;
}

export const boostWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Replace existing boost (unique per user)
    await supabase.from("work_boosts").delete().eq("user_id", context.userId);
    const { error } = await supabase
      .from("work_boosts")
      .insert({ work_id: data.workId, user_id: context.userId });
    if (error) throw new Error(error.message);

    // Implicit vouch (ignore duplicate / self-vouch)
    const { data: work } = await supabase
      .from("works")
      .select("created_by")
      .eq("id", data.workId)
      .maybeSingle();
    if (work && work.created_by !== context.userId) {
      await supabase
        .from("work_vouches")
        .insert({ work_id: data.workId, user_id: context.userId });
    }
    return { ok: true };
  });

export const unboostWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("work_boosts")
      .delete()
      .eq("work_id", data.workId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
