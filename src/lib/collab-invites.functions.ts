import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteToCollab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      collabPostId: z.string().uuid(),
      roleId: z.string().uuid().nullable(),
      inviteeUserId: z.string().uuid(),
      message: z.string().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: post, error: pErr } = await supabase
      .from("collab_posts")
      .select("id,user_id,status")
      .eq("id", data.collabPostId)
      .maybeSingle();
    if (pErr || !post) throw new Error(pErr?.message ?? "Collab not found");
    if (post.user_id !== userId) throw new Error("Only the Collab owner can invite");
    if (data.inviteeUserId === userId) throw new Error("Can't invite yourself");

    const { data: inserted, error } = await supabase
      .from("collab_invites")
      .insert({
        collab_post_id: data.collabPostId,
        collab_role_id: data.roleId,
        inviter_user_id: userId,
        invitee_user_id: data.inviteeUserId,
        message: data.message ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Already invited to this role");
      throw new Error(error.message);
    }
    return { id: inserted.id };
  });

export const respondToInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ inviteId: z.string().uuid(), accept: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("collab_invites")
      .update({
        status: data.accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", data.inviteId)
      .eq("invitee_user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const withdrawInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("collab_invites")
      .update({ status: "withdrawn", responded_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
