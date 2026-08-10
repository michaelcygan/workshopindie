/**
 * "Something new happened in Today" signal for a Group's section bar.
 *
 * Deliberately local: the last-looked marker lives in this browser, so it
 * needs no schema, no write path, and no read of other people's state. It is
 * a return-visit nudge, not a badge to farm — signed-out visitors never see
 * it, and it clears the moment Today is the visible section.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "ws.groupTodaySeen.";

function readSeen(groupId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFIX + groupId);
  } catch {
    return null;
  }
}

function writeSeen(groupId: string, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + groupId, iso);
  } catch {
    /* private mode — the indicator simply stays quiet */
  }
}

export function useTodayUnread({
  groupId,
  enabled,
  active,
}: {
  groupId: string;
  /** Signed-in only. */
  enabled: boolean;
  /** True while Today is the visible section. */
  active: boolean;
}): number {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const since = readSeen(groupId);
    if (!since) {
      // First visit on this device: mark now, start from zero.
      writeSeen(groupId, new Date().toISOString());
      setUnread(0);
      return;
    }
    const { count } = await supabase
      .from("group_today_posts")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .gt("created_at", since)
      .gt("expires_at", new Date().toISOString());
    setUnread(count ?? 0);
  }, [enabled, groupId]);

  // Viewing Today is reading it.
  useEffect(() => {
    if (!enabled) {
      setUnread(0);
      return;
    }
    if (active) {
      writeSeen(groupId, new Date().toISOString());
      setUnread(0);
      return;
    }
    void refresh();
  }, [enabled, active, groupId, refresh]);

  // Messages arriving while Today is open advance the marker instead of
  // lighting the dot behind the reader's back.
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`group-today-unread:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_today_posts",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const createdAt =
            ((payload.new as { created_at?: string } | null)?.created_at) ??
            new Date().toISOString();
          if (active) {
            writeSeen(groupId, createdAt);
            setUnread(0);
          } else {
            setUnread((n) => n + 1);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, active, groupId]);

  return unread;
}
