import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Send a chat message to a live room. Accepts optional `mentions` (user ids)
 * which are stored on the message and turned into `chat_mention` notifications.
 *
 * All policy (length, blocked links, community standards, presence upsert,
 * mention delivery) lives in the shared messaging pipeline.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; body: string; mentions?: string[] }) =>
    z
      .object({
        roomId: z.string().uuid(),
        body: z.string().trim().min(1).max(1000),
        mentions: z.array(z.string().uuid()).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sendRoomMessage } = await import("@/lib/messaging/pipeline.server");
    return sendRoomMessage(
      { supabase, userId, subjectId: data.roomId },
      data.body,
      data.mentions ?? [],
    );
  });
