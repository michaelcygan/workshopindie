import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { collabPostId: string };

function validate(input: Input) {
  if (!input?.collabPostId || typeof input.collabPostId !== "string") {
    throw new Error("collabPostId required");
  }
  return input;
}

export const boostCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Replace existing boost (unique per user)
    await supabase.from("collab_boosts").delete().eq("user_id", context.userId);
    const { error } = await supabase
      .from("collab_boosts")
      .insert({ collab_post_id: data.collabPostId, user_id: context.userId });
    if (error) throw new Error(error.message);

    // Implicit vouch (ignore if already vouched or author)
    const { data: post } = await supabase
      .from("collab_posts")
      .select("user_id")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (post && post.user_id !== context.userId) {
      await supabase
        .from("collab_vouches")
        .insert({ collab_post_id: data.collabPostId, user_id: context.userId });
      // ignore duplicate-key errors
    }
    return { ok: true };
  });

export const unboostCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("collab_boosts")
      .delete()
      .eq("collab_post_id", data.collabPostId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
