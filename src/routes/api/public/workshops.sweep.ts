import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * No-show sweep for scheduled Workshops.
 * Called by pg_cron every minute. For each scheduled Workshop past
 * `starts_at + 15min` that hasn't yet auto-converted, flip to a live
 * drop-in Workshop of the same medium so the room never dies silently.
 */
export const Route = createFileRoute("/api/public/workshops/sweep")({
  server: {
    handlers: {
      POST: async () => {
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data: stale, error } = await supabaseAdmin
          .from("workshops")
          .select("id")
          .eq("mode", "scheduled")
          .is("auto_converted_at", null)
          .lt("starts_at", cutoff)
          .in("status", ["open", "check_in", "active"])
          .limit(50);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        const results: { id: string; converted: boolean; reason?: string }[] = [];
        for (const ws of stale ?? []) {
          // Inline the conversion check rather than calling the server fn directly
          // so we share the same supabaseAdmin context and avoid HTTP overhead.
          const { data: full } = await supabaseAdmin
            .from("workshops")
            .select("id,status,mode,category,title,starts_at,auto_converted_at,host_user_id")
            .eq("id", ws.id)
            .maybeSingle();
          if (!full || full.auto_converted_at || full.mode !== "scheduled" || !full.starts_at) {
            results.push({ id: ws.id, converted: false, reason: "skipped" });
            continue;
          }
          const { data: room } = await supabaseAdmin
            .from("instant_rooms")
            .select("id")
            .eq("workshop_id", full.id)
            .maybeSingle();
          if (room) {
            const { count } = await supabaseAdmin
              .from("instant_presence")
              .select("user_id", { count: "exact", head: true })
              .eq("room_id", room.id);
            if ((count ?? 0) > 0) {
              results.push({ id: ws.id, converted: false, reason: "people_present" });
              continue;
            }
          }
          await supabaseAdmin
            .from("workshops")
            .update({
              mode: "instant_spawned",
              status: "active",
              auto_converted_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            })
            .eq("id", full.id);
          if (!room) {
            await supabaseAdmin.from("instant_rooms").insert({
              kind: "workshop",
              title: full.title,
              status: "active",
              participant_cap: 5,
              creator_id: full.host_user_id,
              category: full.category,
              workshop_id: full.id,
            });
          }
          const { data: rsvps } = await supabaseAdmin
            .from("workshop_participants")
            .select("user_id")
            .eq("workshop_id", full.id);
          const recipients = Array.from(new Set((rsvps ?? []).map((r) => r.user_id)));
          if (recipients.length > 0) {
            await supabaseAdmin
              .from("notifications")
              .insert(
                recipients.map((uid) => ({
                  user_id: uid,
                  kind: uid === full.host_user_id ? "workshop_ran_without_you" : "workshop_now_live",
                  entity_type: "workshop",
                  entity_id: full.id,
                  payload: { title: full.title, auto_converted: true },
                })),
              )
              .then(() => null, () => null);
          }
          results.push({ id: ws.id, converted: true });
        }
        return Response.json({ ok: true, swept: results.length, results });
      },
    },
  },
});
