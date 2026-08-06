import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


export type SuggestedCity = {
  id: string;
  name: string;
  country: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  source: "home" | "ip" | null;
};

function num(h: string | null | undefined): number | null {
  if (!h) return null;
  const n = Number(h);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads Cloudflare geo headers from the current request and returns the
 * nearest active city to the visitor. Nearest-city math runs in the database
 * (`nearest_active_city`) with a distance cap, so this stays correct and cheap
 * as Workshop's locality table grows worldwide. Falls back to country-only
 * matching when no coordinates are available.
 */
async function inferFromHeaders(): Promise<SuggestedCity | null> {
  const lat = num(getRequestHeader("cf-iplatitude"));
  const lng = num(getRequestHeader("cf-iplongitude"));
  const country = (getRequestHeader("cf-ipcountry") ?? "").toUpperCase() || null;

  if (lat !== null && lng !== null) {
    const { data } = await supabaseAdmin.rpc("nearest_active_city", {
      _lat: lat,
      _lng: lng,
      _max_km: 250,
    });
    const near = (data ?? [])[0];
    if (near) {
      return {
        id: near.id,
        name: near.name,
        country: near.country,
        slug: near.slug,
        latitude: near.latitude,
        longitude: near.longitude,
        source: "ip",
      };
    }
  }

  // Country-only fallback — the most established active city in that country.
  if (country) {
    const { data: match } = await supabaseAdmin
      .from("cities")
      .select("id,name,country,slug,latitude,longitude")
      .eq("country_code", country)
      .eq("status", "active")
      .order("name")
      .limit(1)
      .maybeSingle();
    if (match) {
      return {
        id: match.id,
        name: match.name,
        country: match.country,
        slug: match.slug,
        latitude: match.latitude as number | null,
        longitude: match.longitude as number | null,
        source: "ip",
      };
    }
  }

  return null;

}

/**
 * Anonymous-callable: returns a suggested city for the visitor based on
 * Cloudflare geo headers. Used by onboarding and feed banners.
 */
export const inferCityFromIp = createServerFn({ method: "GET" }).handler(
  async () => {
    const city = await inferFromHeaders();
    return { city };
  },
);

/**
 * Returns the city the homepage feed should default to: the signed-in user's
 * home_city if available, otherwise the IP-inferred city, otherwise null.
 * Reads the current user from the Authorization bearer token when present
 * (does NOT require auth — anonymous visitors get an IP suggestion).
 */
export const getDefaultHomeCity = createServerFn({ method: "GET" }).handler(
  async () => {
    const auth = getRequestHeader("authorization");
    const token = auth?.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;

    if (token) {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      const uid = userData.user?.id;
      if (uid) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("home_city_id, cities:home_city_id(id,name,country,slug,latitude,longitude)")
          .eq("id", uid)
          .maybeSingle();
        const c = (profile as { cities?: SuggestedCity | null } | null)?.cities;
        if (c) {
          return {
            city: {
              id: c.id,
              name: c.name,
              country: c.country,
              slug: c.slug,
              latitude: c.latitude,
              longitude: c.longitude,
              source: "home" as const,
            } satisfies SuggestedCity,
          };
        }
      }
    }

    const city = await inferFromHeaders();
    return { city };
  },
);
