import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PinInput = { roomId: string; workId: string };
type UnpinInput = { pinId: string };
type ReorderInput = { roomId: string; orderedIds: string[] };

async function getRoomHost(roomId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("instant_rooms")
    .select("id,host_user_id")
    .eq("id", roomId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Room not found");
  return data as { id: string; host_user_id: string | null };
}

async function ensurePresent(roomId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("instant_presence")
    .select("user_id,last_seen_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .gt("last_seen_at", cutoff)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Join the room before pinning");
}

export const pinWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PinInput) => {
    if (!input?.roomId || !input?.workId) throw new Error("roomId and workId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    await ensurePresent(data.roomId, userId);
    const room = await getRoomHost(data.roomId);
    const isHost = !!room.host_user_id && room.host_user_id === userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (isHost) {
      const { data: maxRow } = await supabaseAdmin
        .from("instant_room_work_pins")
        .select("sort_order")
        .eq("room_id", data.roomId)
        .eq("is_host_pin", true)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = (maxRow?.sort_order ?? 0) + 1;
      const { error } = await supabaseAdmin.from("instant_room_work_pins").upsert(
        {
          room_id: data.roomId,
          work_id: data.workId,
          pinned_by_user_id: userId,
          is_host_pin: true,
          sort_order: nextOrder,
        },
        { onConflict: "room_id,work_id" },
      );
      if (error) throw new Error(error.message);
    } else {
      await supabaseAdmin
        .from("instant_room_work_pins")
        .delete()
        .eq("room_id", data.roomId)
        .eq("pinned_by_user_id", userId)
        .eq("is_host_pin", false);
      const { error } = await supabaseAdmin.from("instant_room_work_pins").upsert(
        {
          room_id: data.roomId,
          work_id: data.workId,
          pinned_by_user_id: userId,
          is_host_pin: false,
          sort_order: 0,
        },
        { onConflict: "room_id,work_id" },
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const unpinWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UnpinInput) => {
    if (!input?.pinId) throw new Error("pinId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pin, error: pinErr } = await supabaseAdmin
      .from("instant_room_work_pins")
      .select("id,room_id,pinned_by_user_id")
      .eq("id", data.pinId)
      .maybeSingle();
    if (pinErr) throw new Error(pinErr.message);
    if (!pin) return { ok: true };
    const room = await getRoomHost(pin.room_id);
    const isHost = !!room.host_user_id && room.host_user_id === context.userId;
    if (!isHost && pin.pinned_by_user_id !== context.userId) {
      throw new Error("Not allowed");
    }
    const { error } = await supabaseAdmin
      .from("instant_room_work_pins")
      .delete()
      .eq("id", data.pinId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderHostWorkPins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReorderInput) => {
    if (!input?.roomId || !Array.isArray(input?.orderedIds)) throw new Error("roomId and orderedIds required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const room = await getRoomHost(data.roomId);
    if (!room.host_user_id || room.host_user_id !== context.userId) {
      throw new Error("Host only");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabaseAdmin
        .from("instant_room_work_pins")
        .update({ sort_order: i + 1 })
        .eq("id", data.orderedIds[i])
        .eq("room_id", data.roomId)
        .eq("is_host_pin", true);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
