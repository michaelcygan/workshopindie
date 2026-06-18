import { createFileRoute } from "@tanstack/react-router";

/**
 * Auto-cancel events that accumulate >=3 unresolved "not_an_event" reports.
 * Called by pg_cron every 15 minutes. Idempotent — skips already-canceled events.
 */
const AUTO_CANCEL_THRESHOLD = 3;

export const Route = createFileRoute("/api/public/events/report-sweep")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: reports, error } = await supabaseAdmin
          .from("reports")
          .select("id,entity_id")
          .eq("entity_type", "group_event")
          .eq("reason", "not_an_event")
          .eq("status", "open")
          .limit(2000);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const byEvent = new Map<string, string[]>();
        for (const r of reports ?? []) {
          const id = r.entity_id as string;
          const arr = byEvent.get(id) ?? [];
          arr.push(r.id as string);
          byEvent.set(id, arr);
        }

        const eligible = Array.from(byEvent.entries()).filter(([, ids]) => ids.length >= AUTO_CANCEL_THRESHOLD);
        if (eligible.length === 0) return Response.json({ ok: true, canceled: 0, considered: byEvent.size });

        const eventIds = eligible.map(([id]) => id);
        const { data: events } = await supabaseAdmin
          .from("group_events")
          .select("id,title,slug,status,group:groups!inner(slug)")
          .in("id", eventIds);
        type Ev = { id: string; title: string; slug: string; status: string; group: { slug: string } };
        const evList = ((events ?? []) as unknown as Ev[]).filter((e) => e.status !== "canceled");

        let canceled = 0;
        for (const ev of evList) {
          const upd = await supabaseAdmin
            .from("group_events")
            .update({ status: "canceled" })
            .eq("id", ev.id)
            .neq("status", "canceled");
          if (upd.error) continue;
          canceled += 1;

          // Notify RSVPs (best-effort)
          try {
            const { data: rsvps } = await supabaseAdmin
              .from("group_event_rsvps")
              .select("user_id")
              .eq("event_id", ev.id)
              .in("status", ["going", "maybe", "waitlist"]);
            if (rsvps && rsvps.length > 0) {
              await supabaseAdmin.from("notifications").insert(
                rsvps.map((r) => ({
                  user_id: r.user_id as string,
                  kind: "event_canceled",
                  entity_type: "group_event",
                  entity_id: ev.id,
                  payload: {
                    event_title: ev.title,
                    event_slug: ev.slug,
                    group_slug: ev.group.slug,
                    reason: `Auto-canceled: ${AUTO_CANCEL_THRESHOLD}+ reports as not a real event.`,
                  },
                })),
              );
            }
          } catch { /* best-effort */ }
        }

        // Resolve the reports for canceled events
        const canceledIds = new Set(evList.map((e) => e.id));
        const resolveIds: string[] = [];
        for (const [eid, ids] of byEvent) {
          if (canceledIds.has(eid)) resolveIds.push(...ids);
        }
        if (resolveIds.length > 0) {
          await supabaseAdmin.from("reports").update({ status: "action_taken" }).in("id", resolveIds);
        }

        return Response.json({ ok: true, canceled, considered: byEvent.size });
      },
    },
  },
});
