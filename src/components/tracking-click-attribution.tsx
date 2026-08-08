import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { markTrackingClickMember } from "@/lib/tracking-links.functions";
import { TRACKING_CLICK_PARAM } from "@/lib/tracking-links.shared";

/**
 * Upgrades a tracking-link click from "guest" to "member".
 *
 * `/go/<slug>` redirects instantly and can't know whether the browser holds a
 * Workshop session, so it always records a guest. Once the destination page
 * hydrates and the session is confirmed, this pings once and the click is
 * reclassified. The marker is then stripped from the URL so it never gets
 * bookmarked, shared or double-counted.
 */
export function TrackingClickAttribution() {
  const { user, loading } = useAuth();
  const mark = useServerFn(markTrackingClickMember);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;

    const params = new URLSearchParams(window.location.search);
    const clickId = params.get(TRACKING_CLICK_PARAM);
    if (!clickId) return;

    const strip = () => {
      params.delete(TRACKING_CLICK_PARAM);
      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
      );
    };

    if (!user) {
      strip();
      return;
    }

    let cancelled = false;
    void mark({ data: { clickId } })
      .catch(() => {
        /* measurement only — never surface this to the visitor */
      })
      .finally(() => {
        if (!cancelled) strip();
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, mark]);

  return null;
}
