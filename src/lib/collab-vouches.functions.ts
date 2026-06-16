import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { collabPostId: string };

function validate(input: Input) {
  if (!input?.collabPostId || typeof input.collabPostId !== "string") {
    throw new Error("collabPostId required");
  }
  return input;
}

export const vouchCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("collab_vouches")
      .insert({ collab_post_id: data.collabPostId, user_id: context.userId });
    if (error && !/duplicate key/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const unvouchCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("collab_vouches")
      .delete()
      .eq("collab_post_id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
