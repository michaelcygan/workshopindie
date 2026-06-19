import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { pingPresence } from "@/lib/friends.functions";

const INTERVAL_MS = 60_000;

/**
 * Lightweight global online signal: updates profiles.last_active_at every
 * minute while the user is signed in and the tab is visible. No realtime,
 * no subscriptions — just a heartbeat the friends list reads.
 */
export function PresenceHeartbeat() {
  const { user } = useAuth();
  const ping = useServerFn(pingPresence);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      ping().catch(() => {});
    };

    beat();
    timer = setInterval(beat, INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, ping]);

  return null;
}
