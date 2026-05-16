import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Purge all whiteboard assets (storage objects + rows) for a given Instant room.
 * Called when the room empties or is archived so nothing lingers past the session.
 *
 * Safe to call from any participant: the room is ephemeral, and the assets
 * are only meaningful while the room is live.
 */
export const purgeRoomWhiteboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { roomId } = data;
    // List all rows for this room (storage paths)
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("instant_whiteboard_assets")
      .select("storage_path")
      .eq("room_id", roomId);
    if (rowsErr) return { ok: false, error: rowsErr.message };
    const paths = (rows ?? []).map((r) => r.storage_path).filter(Boolean);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("instant-whiteboard").remove(paths);
    }
    await supabaseAdmin.from("instant_whiteboard_assets").delete().eq("room_id", roomId);
    await supabaseAdmin.from("instant_board_items").delete().eq("room_id", roomId);
    return { ok: true, purged: paths.length };
  });
