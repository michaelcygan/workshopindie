import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supabase as supabaseAnon } from "@/integrations/supabase/client";

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

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Reads Cloudflare geo headers from the current request and returns the
 * nearest city in `public.cities` to the visitor. Falls back to country-only
 * matching when no coordinates are available.
 */
async function inferFromHeaders(): Promise<SuggestedCity | null> {
  const lat = num(getRequestHeader("cf-iplatitude"));
  const lng = num(getRequestHeader("cf-iplongitude"));
  const country = (getRequestHeader("cf-ipcountry") ?? "").toUpperCase() || null;

  const { data: rows } = await supabaseAdmin
    .from("cities")
    .select("id,name,country,slug,latitude,longitude");
  if (!rows || rows.length === 0) return null;

  // Coordinates available — pick nearest globally
  if (lat !== null && lng !== null) {
    let best: { row: typeof rows[number]; dist: number } | null = null;
    for (const r of rows) {
      if (r.latitude === null || r.longitude === null) continue;
      const d = haversineKm(
        { lat, lng },
        { lat: r.latitude as number, lng: r.longitude as number },
      );
      if (!best || d < best.dist) best = { row: r, dist: d };
    }
    if (best) {
      return {
        id: best.row.id,
        name: best.row.name,
        country: best.row.country,
        slug: best.row.slug,
        latitude: best.row.latitude as number | null,
        longitude: best.row.longitude as number | null,
        source: "ip",
      };
    }
  }

  // Country-only fallback — pick the first city in that country
  if (country) {
    const match = rows.find(
      (r) => (r.country ?? "").toUpperCase().startsWith(country),
    );
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
      const { data: userData } = await supabaseAnon.auth.getUser(token);
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
