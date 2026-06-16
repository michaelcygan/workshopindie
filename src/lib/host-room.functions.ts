import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const REMOVAL_MINUTES = 30;

async function assertHost(roomId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: room, error } = await supabaseAdmin
    .from("instant_rooms")
    .select("id, host_user_id, status, kind")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!room) throw new Error("Room not found");
  if ((room as any).host_user_id !== userId) throw new Error("Only the host can do that");
  return room as { id: string; host_user_id: string; status: string; kind: string };
}

/** Host: set or clear the focus message shown to everyone in the room. */
export const setRoomFocusMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; text: string | null }) =>
    z.object({
      roomId: z.string().uuid(),
      text: z.string().trim().max(140).nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertHost(data.roomId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const text = data.text && data.text.length > 0 ? data.text : null;
    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({ focus_message: text } as any)
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true, focus_message: text };
  });

/** Host: lock/unlock the room. Locked rooms don't fill via matchmaker and reject direct joins. */
export const setRoomLocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; locked: boolean }) =>
    z.object({ roomId: z.string().uuid(), locked: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertHost(data.roomId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({ locked: data.locked } as any)
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true, locked: data.locked };
  });

/** Host: remove a participant for 30 minutes (room-scoped only). */
export const removeFromRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; targetUserId: string }) =>
    z.object({ roomId: z.string().uuid(), targetUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const room = await assertHost(data.roomId, context.userId);
    if (data.targetUserId === room.host_user_id) {
      throw new Error("You can't remove yourself");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const until = new Date(Date.now() + REMOVAL_MINUTES * 60_000).toISOString();
    const { error: rmErr } = await supabaseAdmin
      .from("instant_room_removals")
      .upsert({
        room_id: data.roomId,
        user_id: data.targetUserId,
        until,
        removed_by: context.userId,
      } as any);
    if (rmErr) throw new Error(rmErr.message);
    // Drop their presence row so the room reflects them leaving immediately.
    await supabaseAdmin
      .from("instant_presence")
      .delete()
      .eq("room_id", data.roomId)
      .eq("user_id", data.targetUserId);
    return { ok: true, until, minutes: REMOVAL_MINUTES };
  });

/** Host: end the Workshop for everyone. */
export const endRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) =>
    z.object({ roomId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertHost(data.roomId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({
        status: "archived",
        ended_by_user_id: context.userId,
      } as any)
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
