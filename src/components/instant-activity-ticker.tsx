import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listRecentActivity, type InstantActivityEvent } from "@/lib/instant.functions";
import { formatRoomTitle } from "@/lib/instant";

function formatEvent(e: InstantActivityEvent): string {
  const title = formatRoomTitle(e.title, (e as any).medium ?? null);
  if (e.kind === "join") {
    const who = e.actor_display_name ?? "Someone";
    return `${who} just joined ${title}`;
  }
  if (e.kind === "spawn") return `${title} just started`;
  return `${title} just ended`;
}

export function InstantActivityTicker() {
  const fetchEvents = useServerFn(listRecentActivity);
  const { data, refetch } = useQuery({
    queryKey: ["instant-activity"],
    queryFn: () => fetchEvents({ data: { limit: 20 } }),
    refetchInterval: 15000,
  });

  const [events, setEvents] = useState<InstantActivityEvent[]>([]);
  useEffect(() => {
    if (data?.events) setEvents(data.events);
  }, [data]);

  useEffect(() => {
    const ch = supabase
      .channel("instant-activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "instant_activity" },
        (payload) => {
          const ev = payload.new as InstantActivityEvent;
          setEvents((prev) => [ev, ...prev].slice(0, 20));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      void refetch;
    };
  }, [refetch]);

  if (events.length === 0) {
    return (
      <div className="mt-8 text-center text-xs text-ink-muted opacity-70">
        Quiet for now — be the first to drop in.
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 px-1 pb-2 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        <span className="h-px flex-1 bg-ink/10" />
        Live now
        <span className="h-px flex-1 bg-ink/10" />
      </div>
      <div className="group relative h-28 overflow-hidden rounded-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent" />
        <ul className="flex flex-col gap-1.5 px-3 py-3 text-sm text-ink-muted group-hover:[animation-play-state:paused]">
          <AnimatePresence initial={false}>
            {events.slice(0, 8).map((e) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="truncate"
              >
                <span className="gradient-motion mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle" />
                {formatEvent(e)}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  );
}
