import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * One group-scoped realtime subscription for the event artery.
 *
 * Any insert/update/delete on `group_events` or `event_groups` invalidates the
 * event-bearing caches together (group events tab, next-event card, Today
 * modules, member home, the public /events feed), so every surface refreshes
 * from the same signal instead of each card opening its own channel.
 */
export function useEventsRealtime(groupId?: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      const keys: unknown[][] = [
        ["events"],
        ["public-events"],
        ["home"],
        ["home-pulse"],
        ["my-groups-upcoming-events"],
      ];
      if (groupId) {
        keys.push(["group", groupId, "events"], ["group", groupId, "next-event"], [
          "group",
          groupId,
          "today",
        ]);
      }
      for (const queryKey of keys) qc.invalidateQueries({ queryKey });
    };

    const filter = groupId ? `group_id=eq.${groupId}` : undefined;
    const channel = supabase
      .channel(`events-artery:${groupId ?? "global"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_events", ...(filter ? { filter } : {}) },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_groups",
          ...(groupId ? { filter: `group_id=eq.${groupId}` } : {}),
        },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, qc]);
}
