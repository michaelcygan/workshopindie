import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const groupInput = z.object({ groupId: z.string().uuid() });
const leaveInput = z.object({ roomId: z.string().uuid() });

/**
 * Enter this Group's audio room as a listener.
 *
 * Order matters: authenticate → verify real Group membership → match a room →
 * atomically claim a presence seat. Only after this resolves may the client
 * mint a Stream token (`getLoungeStreamToken` re-checks the presence row).
 * Joining audio never adds the caller to the Group.
 */
export const joinGroupAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => groupInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertGroupAudioAccess, admitToGroupAudio } = await import("@/lib/group-audio.server");
    await assertGroupAudioAccess(context.userId, data.groupId);
    return admitToGroupAudio(context.userId, data.groupId);
  });

/** Release the caller's seat + speaker state. Leaving audio never leaves the Group. */
export const leaveGroupAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => leaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { leaveGroupAudioRoom } = await import("@/lib/group-audio.server");
    await leaveGroupAudioRoom(context.userId, data.roomId);
    return { ok: true };
  });

/** Live audio state for a Group: active room + how many are connected. */
export const getGroupAudioState = createServerFn({ method: "POST" })
  .inputValidator((input: { groupId: string }) => groupInput.parse(input))
  .handler(async ({ data }) => {
    const { readGroupAudioState } = await import("@/lib/group-audio-state.server");
    return readGroupAudioState(data.groupId);
  });
