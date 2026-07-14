import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type StartInput = { roomId: string; workId: string };
type StopInput = { roomId: string };

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
  if (!data) throw new Error("Join the Lounge before screening a Work");
}

export const startScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartInput) => {
    if (!input?.roomId || !input?.workId) throw new Error("roomId and workId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensurePresent(data.roomId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Work must be published and have an embed_url.
    const { data: work, error: workErr } = await supabaseAdmin
      .from("works")
      .select("id,status,embed_url")
      .eq("id", data.workId)
      .maybeSingle();
    if (workErr) throw new Error(workErr.message);
    if (!work) throw new Error("Work not found");
    if (work.status !== "published") throw new Error("Only published Works can be screened");
    if (!work.embed_url) throw new Error("This Work has no playable embed");

    // Must be pinned in this Lounge first.
    const { data: pin, error: pinErr } = await supabaseAdmin
      .from("instant_room_work_pins")
      .select("id")
      .eq("room_id", data.roomId)
      .eq("work_id", data.workId)
      .maybeSingle();
    if (pinErr) throw new Error(pinErr.message);
    if (!pin) throw new Error("Pin this Work to the Lounge before screening it");

    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({ screening_work_id: data.workId })
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const stopScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StopInput) => {
    if (!input?.roomId) throw new Error("roomId required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensurePresent(data.roomId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("instant_rooms")
      .update({ screening_work_id: null })
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
