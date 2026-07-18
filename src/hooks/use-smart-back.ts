import { useCallback } from "react";
import { useRouter, type LinkProps } from "@tanstack/react-router";

/**
 * Smart "Back" handler: uses browser history when the user arrived via
 * in-app navigation, otherwise falls back to a sensible route. This keeps
 * scroll position and search-param context intact instead of hard-jumping
 * to a fixed destination.
 */
export function useSmartBack(fallback: LinkProps) {
  const router = useRouter();
  return useCallback(() => {
    try {
      const hasHistory =
        typeof window !== "undefined" && window.history.length > 1;
      const referrer = typeof document !== "undefined" ? document.referrer : "";
      const sameOrigin =
        !referrer || (typeof window !== "undefined" && referrer.startsWith(window.location.origin));
      if (hasHistory && sameOrigin) {
        router.history.back();
        return;
      }
    } catch {
      /* fall through */
    }
    router.navigate(fallback as never);
  }, [router, fallback]);
}
