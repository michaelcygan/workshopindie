import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence/policy";
import {
  documentReferrerHost,
  getSessionId,
  getVisitorId,
  sendLiveHeartbeat,
  sendPageview,
} from "@/lib/traffic/identity";
import {
  isExcludedTrafficPath,
  normalizeRoutePattern,
  normalizeTrafficPath,
} from "@/lib/traffic/shared";

/**
 * The single global traffic tracker.
 *
 * One real page view — initial load, link navigation, back, forward, refresh —
 * produces exactly one record. Query-only changes (`/groups?t=city` →
 * `?t=genre`) are the same page, so they are not re-counted, and the query
 * string is never sent anywhere. Excluded surfaces (admin, DMs, auth,
 * account-management) are never recorded at all.
 *
 * Nothing here blocks rendering or navigation: the send is fire-and-forget.
 */
export function TrafficTracker() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth() as { user: unknown; loading?: boolean };
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Wait for the first auth resolution so member/guest classification is
    // honest — but only while it is still resolving, never indefinitely.
    if (loading) return;

    const path = normalizeTrafficPath(pathname);
    if (!path || isExcludedTrafficPath(path)) return;
    // StrictMode double-effects, re-renders and route invalidation all replay
    // this effect with the same path; only a real path change counts.
    if (lastPath.current === path) return;
    lastPath.current = path;

    let routePattern: string | null = null;
    try {
      const matches = router.state.matches;
      routePattern = normalizeRoutePattern(matches[matches.length - 1]?.routeId as string);
    } catch {
      routePattern = null;
    }

    sendPageview({
      visitorId: getVisitorId(),
      sessionId: getSessionId(),
      path,
      routePattern,
      visitorType: user ? "member" : "guest",
      referrerHost: documentReferrerHost(),
    });
  }, [pathname, loading, user, router]);

  // Live presence: the same anonymous session, beating once a minute while the
  // tab is actually visible. Nothing new is identified — this only answers
  // "how many tabs are here right now", and it is entirely expendable.
  const liveRef = useRef({ path: null as string | null, type: "guest" as "guest" | "member" });
  liveRef.current = {
    path: (() => {
      const p = normalizeTrafficPath(pathname);
      return p && !isExcludedTrafficPath(p) ? p : null;
    })(),
    type: user ? "member" : "guest",
  };

  useEffect(() => {
    if (loading) return;
    if (typeof document === "undefined") return;

    const beat = () => {
      try {
        if (document.visibilityState !== "visible") return;
        const { path, type } = liveRef.current;
        if (!path) return;
        sendLiveHeartbeat({
          sessionId: getSessionId(),
          path,
          visitorType: type,
          source: documentReferrerHost(),
        });
      } catch {
        /* measurement is optional */
      }
    };

    beat();
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loading]);

  // A path change should be reflected promptly, not only on the next minute.
  useEffect(() => {
    if (loading) return;
    if (typeof document === "undefined" || document.visibilityState !== "visible") return;
    const { path, type } = liveRef.current;
    if (!path) return;
    sendLiveHeartbeat({
      sessionId: getSessionId(),
      path,
      visitorType: type,
      source: documentReferrerHost(),
    });
  }, [pathname, loading]);

  return null;
}
