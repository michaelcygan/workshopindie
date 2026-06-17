import { createFileRoute } from "@tanstack/react-router";

/**
 * Group events sweep — pg_cron POSTs every 5 minutes.
 * - flip scheduled → live → completed at the boundaries
 * - fire `event_starts_soon_24h` / `event_starts_soon_2h` once per event
 * - fire `event_recap` once, 24h after ends_at
 */
export const Route = createFileRoute("/api/public/events/sweep")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const nowIso = now.toISOString();

        // Status transitions
        await supabaseAdmin
          .from("group_events")
          .update({ status: "live" })
          .eq("status", "scheduled")
          .lte("starts_at", nowIso)
          .gt("ends_at", nowIso);

        await supabaseAdmin
          .from("group_events")
          .update({ status: "completed" })
          .in("status", ["scheduled", "live"])
          .lt("ends_at", nowIso);

        async function notifyWindow(column: "notified_24h_at" | "notified_2h_at", kind: string, hoursAhead: number) {
          const winStart = new Date(now.getTime() + (hoursAhead - 0.1) * 3600 * 1000).toISOString();
          const winEnd = new Date(now.getTime() + (hoursAhead + 0.1) * 3600 * 1000).toISOString();
          const { data: events } = await supabaseAdmin
            .from("group_events")
            .select("id,title,slug,group:groups!inner(slug)")
            .is(column, null)
            .neq("status", "canceled")
            .is("deleted_at", null)
            .gte("starts_at", winStart)
            .lte("starts_at", winEnd)
            .limit(50);
          for (const e of (events ?? [])) {
            type E = { id: string; title: string; slug: string; group: { slug: string } };
            const ev = e as unknown as E;
            const { data: rsvps } = await supabaseAdmin
              .from("group_event_rsvps")
              .select("user_id")
              .eq("event_id", ev.id)
              .eq("status", "going");
            const payload = { event_title: ev.title, event_slug: ev.slug, group_slug: ev.group.slug };
            if (rsvps && rsvps.length > 0) {
              await supabaseAdmin.from("notifications").insert(
                rsvps.map((r) => ({
                  user_id: r.user_id as string,
                  kind,
                  entity_type: "group_event",
                  entity_id: ev.id,
                  payload,
                })),
              );
            }
            await supabaseAdmin.from("group_events").update({ [column]: nowIso } as never).eq("id", ev.id);
          }
        }

        await notifyWindow("notified_24h_at", "event_starts_soon_24h", 24);
        await notifyWindow("notified_2h_at", "event_starts_soon_2h", 2);

        // Recap (24h after end)
        const recapWindowStart = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
        const recapWindowEnd = new Date(now.getTime() - 23 * 3600 * 1000).toISOString();
        const { data: recapEvents } = await supabaseAdmin
          .from("group_events")
          .select("id,title,slug,group:groups!inner(slug)")
          .is("notified_recap_at", null)
          .is("deleted_at", null)
          .gte("ends_at", recapWindowStart)
          .lte("ends_at", recapWindowEnd)
          .limit(50);
        for (const e of (recapEvents ?? [])) {
          type E = { id: string; title: string; slug: string; group: { slug: string } };
          const ev = e as unknown as E;
          const { data: rsvps } = await supabaseAdmin
            .from("group_event_rsvps")
            .select("user_id")
            .eq("event_id", ev.id)
            .eq("status", "going");
          if (rsvps && rsvps.length > 0) {
            await supabaseAdmin.from("notifications").insert(
              rsvps.map((r) => ({
                user_id: r.user_id as string,
                kind: "event_recap",
                entity_type: "group_event",
                entity_id: ev.id,
                payload: { event_title: ev.title, event_slug: ev.slug, group_slug: ev.group.slug },
              })),
            );
          }
          await supabaseAdmin.from("group_events").update({ notified_recap_at: nowIso }).eq("id", ev.id);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
