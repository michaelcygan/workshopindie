import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Purge ephemeral room artifacts for a given Instant room.
 * Called when the room empties or is archived so nothing lingers past the session.
 *
 * The whiteboard feature has been removed; this now just clears board items.
 */
export const purgeRoomWhiteboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { roomId } = data;
    await supabaseAdmin.from("instant_board_items").delete().eq("room_id", roomId);
    return { ok: true };
  });
