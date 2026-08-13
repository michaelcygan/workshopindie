import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { gtagEvent, gtagPageView, initGoogleAnalytics } from "@/lib/analytics/google";

/**
 * Google Analytics 4 SPA tracker.
 *
 * gtag.js only records the initial page load automatically. TanStack Router
 * handles subsequent navigation client-side, so we listen for pathname changes
 * and emit a page_view event for each new route.
 *
 * Auth events are tracked separately so sign_up vs login can be reported
 * without leaking any profile or identity data.
 */
export function GoogleAnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastPath = useRef<string | null>(null);

  // Initialize gtag once the app hydrates.
  useEffect(() => {
    initGoogleAnalytics();
  }, []);

  // Track client-side route changes.
  useEffect(() => {
    if (!pathname) return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    gtagPageView(pathname, document.title);
  }, [pathname]);

  // Track auth lifecycle events (sign_up vs returning login). No PII.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      const e = event as string;
      if (e === "SIGNED_UP") {
        gtagEvent("sign_up", { method: "oauth" });
      } else if (e === "SIGNED_IN") {
        gtagEvent("login", { method: "oauth" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);



  return null;
}

