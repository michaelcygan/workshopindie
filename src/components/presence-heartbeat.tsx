import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { pingPresence } from "@/lib/friends.functions";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence/policy";

/**
 * Global online signal. Beats once per interval while signed in and the tab is
 * visible, pauses while hidden, resumes on focus, stops on sign-out.
 *
 * The write target is the ephemeral presence tier — see @/lib/presence/policy.
 * profiles.last_active_at is only refreshed on a coarse throttle server-side,
 * so open tabs no longer amplify writes onto a table the whole app reads.
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

    // Sessions that start in the same second would otherwise beat in lockstep
    // forever. A random offset inside the first quarter of the interval spreads
    // the writes out; the interval itself is unchanged.
    const jitter = Math.floor(Math.random() * (HEARTBEAT_INTERVAL_MS / 4));
    const start = setTimeout(() => {
      if (cancelled) return;
      beat();
      timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    }, jitter);

    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearTimeout(start);
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, ping]);


  return null;
}
