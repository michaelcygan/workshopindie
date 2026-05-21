import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDefaultHomeCity, type SuggestedCity } from "@/lib/geo.functions";

/**
 * Returns the city the current visitor's feeds should default to:
 *  - signed-in user's `home_city_id` if set
 *  - otherwise the Cloudflare-IP-inferred nearest city
 *  - otherwise `null`
 *
 * `source` distinguishes the two so UI can show the right banner copy.
 */
export function useDefaultCity() {
  const fn = useServerFn(getDefaultHomeCity);
  return useQuery({
    queryKey: ["default-home-city"],
    queryFn: () => fn(),
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/**
 * Auto-apply the default city to a feed's `?city=…` URL on first visit per
 * session. Skips when the user has explicitly chosen a city. Pass the
 * current `citySlug` from the URL and a setter that updates the search.
 *
 * `feedKey` namespaces the sessionStorage flag so each feed (gallery /
 * collab / workshops) gets its own first-visit application.
 */
export function useApplyDefaultCity(opts: {
  feedKey: string;
  isWorldwide: boolean;
  apply: (city: SuggestedCity) => void;
  defaultCity: SuggestedCity | null | undefined;
}) {
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    if (!opts.defaultCity) return;
    if (!opts.isWorldwide) return;
    if (typeof window === "undefined") return;
    const key = `geo.applied.${opts.feedKey}`;
    if (window.sessionStorage.getItem(key) === "1") return;
    window.sessionStorage.setItem(key, "1");
    applied.current = true;
    opts.apply(opts.defaultCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.defaultCity?.slug, opts.isWorldwide]);
}
