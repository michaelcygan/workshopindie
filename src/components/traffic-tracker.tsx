import { useEffect, useRef } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  documentReferrerHost,
  getSessionId,
  getVisitorId,
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

  return null;
}
