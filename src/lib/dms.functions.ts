import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { domainError } from "@/lib/errors";
import { withOpLog } from "@/lib/obs/log";
import { z } from "zod";

const uuidSchema = z.string().uuid();

function pairOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export const checkCanDm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { otherUserId: string }) => ({
    otherUserId: uuidSchema.parse(d.otherUserId),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.rpc("can_dm", {
      _a: userId,
      _b: data.otherUserId,
    });
    if (error) throw new Error(error.message);
    return { canDm: Boolean(rows) };
  });

export const openOrCreateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      otherUserId: string;
      contextCollabPostId?: string | null;
      contextWorkshopId?: string | null;
      contextWorkId?: string | null;
      contextCommentId?: string | null;
    }) => ({
      otherUserId: uuidSchema.parse(d.otherUserId),
      contextCollabPostId: d.contextCollabPostId ? uuidSchema.parse(d.contextCollabPostId) : null,
      contextWorkshopId: d.contextWorkshopId ? uuidSchema.parse(d.contextWorkshopId) : null,
      contextWorkId: d.contextWorkId ? uuidSchema.parse(d.contextWorkId) : null,
      contextCommentId: d.contextCommentId ? uuidSchema.parse(d.contextCommentId) : null,
    }),
  )
  .handler(async ({ data, context }) =>
    withOpLog(
      "dm.open",
      { entity: "profile", entityId: data.otherUserId, authed: true },
      async () => {
        const { supabase, userId } = context;
        if (userId === data.otherUserId)
          throw domainError("INVALID_INPUT", "Cannot message yourself");

        // Atomic get-or-create: opening the same thread from both sides at the
        // same moment returns the one canonical conversation instead of racing.
        const { data: conversationId, error } = await supabase.rpc("get_or_create_conversation", {
          _other: data.otherUserId,
          _context_collab_post_id: data.contextCollabPostId,
          _context_workshop_id: data.contextWorkshopId,
          _context_work_id: data.contextWorkId,
          _context_comment_id: data.contextCommentId,
        } as never);
        if (error) throw new Error(error.message);
        return { conversationId: conversationId as unknown as string };
      },
    ),
  );

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string; body: string }) => ({
    conversationId: uuidSchema.parse(d.conversationId),
    body: z.string().trim().min(1).max(2000).parse(d.body),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Shared messaging policy: normalize → validate → rate limit → moderate →
    // persist. Blocks are enforced by can_dm(...) inside the insert policy.
    const { sendDirectMessage } = await import("@/lib/messaging/pipeline.server");
    return sendDirectMessage({ supabase, userId, subjectId: data.conversationId }, data.body);
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conversationId: string }) => ({
    conversationId: uuidSchema.parse(d.conversationId),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId)
      .neq("sender_id", userId)
      .is("read_at", null)
      .select("id");
    // Surface permission/policy failures instead of silently no-op'ing, which
    // previously left the inbox badge permanently stuck on an old thread.
    if (error) throw new Error(error.message);
    return { ok: true, marked: rows?.length ?? 0 };
  });
