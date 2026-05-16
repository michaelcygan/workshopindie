import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Ensure a workshop has a paired live room (instant_rooms row of kind='workshop').
 * Only the host or a confirmed/checked-in/completed participant may obtain it.
 * Idempotent: returns the existing paired room id if one exists.
 */
export const ensureWorkshopRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workshopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { workshopId } = data;
    const { userId } = context;

    const { data: ws, error: wsErr } = await supabaseAdmin
      .from("workshops")
      .select("id,title,host_user_id,participant_cap,category")
      .eq("id", workshopId)
      .maybeSingle();
    if (wsErr || !ws) throw new Error(wsErr?.message ?? "Workshop not found");

    if (ws.host_user_id !== userId) {
      const { data: part } = await supabaseAdmin
        .from("workshop_participants")
        .select("id")
        .eq("workshop_id", workshopId)
        .eq("user_id", userId)
        .in("participant_status", ["confirmed", "checked_in", "completed"])
        .maybeSingle();
      if (!part) throw new Error("Not a participant of this workshop");
    }

    const { data: existing } = await supabaseAdmin
      .from("instant_rooms")
      .select("id")
      .eq("workshop_id", workshopId)
      .maybeSingle();
    if (existing?.id) return { roomId: existing.id };

    const { data: created, error: createErr } = await supabaseAdmin
      .from("instant_rooms")
      .insert({
        kind: "workshop",
        title: ws.title,
        status: "active",
        participant_cap: ws.participant_cap ?? 12,
        creator_id: ws.host_user_id,
        category: ws.category,
        workshop_id: workshopId,
      })
      .select("id")
      .single();
    if (createErr || !created) throw new Error(createErr?.message ?? "Couldn't open the room");
    return { roomId: created.id };
  });
