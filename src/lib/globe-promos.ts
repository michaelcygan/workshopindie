import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GlobeCity = { name: string; lon: number; lat: number };

export type GlobePromo = {
  kind: "work" | "collab" | "group";
  title: string;
  href: string;
  from: GlobeCity;
  to?: GlobeCity; // absent for `group` (drop-pin only)
  verb?: string;
};

// Curated coord map — keyed by lowercased city name.
// Extend freely; unknown cities fall back to a random known city.
export const CITY_COORDS: Record<string, { lon: number; lat: number }> = {
  "lagos": { lon: 3.38, lat: 6.52 },
  "berlin": { lon: 13.4, lat: 52.52 },
  "são paulo": { lon: -46.63, lat: -23.55 },
  "sao paulo": { lon: -46.63, lat: -23.55 },
  "tokyo": { lon: 139.69, lat: 35.69 },
  "mexico city": { lon: -99.13, lat: 19.43 },
  "lisbon": { lon: -9.14, lat: 38.72 },
  "nairobi": { lon: 36.82, lat: -1.29 },
  "toronto": { lon: -79.38, lat: 43.65 },
  "seoul": { lon: 126.98, lat: 37.57 },
  "paris": { lon: 2.35, lat: 48.86 },
  "mumbai": { lon: 72.88, lat: 19.08 },
  "new york": { lon: -74.0, lat: 40.71 },
  "new york city": { lon: -74.0, lat: 40.71 },
  "brooklyn": { lon: -73.94, lat: 40.65 },
  "bali": { lon: 115.19, lat: -8.41 },
  "cape town": { lon: 18.42, lat: -33.92 },
  "buenos aires": { lon: -58.38, lat: -34.6 },
  "sydney": { lon: 151.21, lat: -33.87 },
  "melbourne": { lon: 144.96, lat: -37.81 },
  "london": { lon: -0.13, lat: 51.51 },
  "los angeles": { lon: -118.24, lat: 34.05 },
  "san francisco": { lon: -122.42, lat: 37.77 },
  "oakland": { lon: -122.27, lat: 37.8 },
  "seattle": { lon: -122.33, lat: 47.6 },
  "portland": { lon: -122.68, lat: 45.52 },
  "chicago": { lon: -87.63, lat: 41.88 },
  "austin": { lon: -97.74, lat: 30.27 },
  "nashville": { lon: -86.78, lat: 36.16 },
  "atlanta": { lon: -84.39, lat: 33.75 },
  "miami": { lon: -80.19, lat: 25.76 },
  "detroit": { lon: -83.04, lat: 42.33 },
  "minneapolis": { lon: -93.27, lat: 44.98 },
  "denver": { lon: -104.99, lat: 39.74 },
  "boston": { lon: -71.06, lat: 42.36 },
  "philadelphia": { lon: -75.16, lat: 39.95 },
  "washington": { lon: -77.04, lat: 38.9 },
  "washington, dc": { lon: -77.04, lat: 38.9 },
  "houston": { lon: -95.37, lat: 29.76 },
  "dallas": { lon: -96.8, lat: 32.78 },
  "phoenix": { lon: -112.07, lat: 33.45 },
  "las vegas": { lon: -115.14, lat: 36.17 },
  "istanbul": { lon: 28.98, lat: 41.01 },
  "bangkok": { lon: 100.5, lat: 13.76 },
  "montreal": { lon: -73.57, lat: 45.5 },
  "vancouver": { lon: -123.12, lat: 49.28 },
  "accra": { lon: -0.19, lat: 5.6 },
  "amsterdam": { lon: 4.9, lat: 52.37 },
  "rotterdam": { lon: 4.48, lat: 51.92 },
  "copenhagen": { lon: 12.57, lat: 55.68 },
  "stockholm": { lon: 18.07, lat: 59.33 },
  "oslo": { lon: 10.75, lat: 59.91 },
  "helsinki": { lon: 24.94, lat: 60.17 },
  "dublin": { lon: -6.26, lat: 53.35 },
  "edinburgh": { lon: -3.19, lat: 55.95 },
  "manchester": { lon: -2.24, lat: 53.48 },
  "glasgow": { lon: -4.25, lat: 55.86 },
  "madrid": { lon: -3.7, lat: 40.42 },
  "barcelona": { lon: 2.17, lat: 41.39 },
  "porto": { lon: -8.61, lat: 41.15 },
  "rome": { lon: 12.5, lat: 41.9 },
  "milan": { lon: 9.19, lat: 45.46 },
  "athens": { lon: 23.73, lat: 37.98 },
  "vienna": { lon: 16.37, lat: 48.21 },
  "prague": { lon: 14.44, lat: 50.08 },
  "warsaw": { lon: 21.01, lat: 52.23 },
  "budapest": { lon: 19.04, lat: 47.5 },
  "zurich": { lon: 8.54, lat: 47.37 },
  "brussels": { lon: 4.35, lat: 50.85 },
  "hamburg": { lon: 10.0, lat: 53.55 },
  "munich": { lon: 11.58, lat: 48.14 },
  "cologne": { lon: 6.96, lat: 50.94 },
  "reykjavík": { lon: -21.94, lat: 64.15 },
  "reykjavik": { lon: -21.94, lat: 64.15 },
  "tel aviv": { lon: 34.78, lat: 32.08 },
  "dubai": { lon: 55.3, lat: 25.2 },
  "beirut": { lon: 35.5, lat: 33.89 },
  "cairo": { lon: 31.24, lat: 30.04 },
  "casablanca": { lon: -7.59, lat: 33.57 },
  "marrakech": { lon: -7.99, lat: 31.63 },
  "johannesburg": { lon: 28.05, lat: -26.2 },
  "kigali": { lon: 30.06, lat: -1.94 },
  "kampala": { lon: 32.58, lat: 0.35 },
  "dakar": { lon: -17.45, lat: 14.72 },
  "addis ababa": { lon: 38.75, lat: 9.03 },
  "delhi": { lon: 77.21, lat: 28.61 },
  "new delhi": { lon: 77.21, lat: 28.61 },
  "bengaluru": { lon: 77.59, lat: 12.97 },
  "bangalore": { lon: 77.59, lat: 12.97 },
  "chennai": { lon: 80.27, lat: 13.08 },
  "kolkata": { lon: 88.36, lat: 22.57 },
  "colombo": { lon: 79.86, lat: 6.93 },
  "kathmandu": { lon: 85.32, lat: 27.71 },
  "singapore": { lon: 103.82, lat: 1.35 },
  "kuala lumpur": { lon: 101.69, lat: 3.14 },
  "jakarta": { lon: 106.85, lat: -6.21 },
  "manila": { lon: 120.98, lat: 14.6 },
  "ho chi minh city": { lon: 106.63, lat: 10.82 },
  "hanoi": { lon: 105.85, lat: 21.03 },
  "hong kong": { lon: 114.17, lat: 22.32 },
  "taipei": { lon: 121.57, lat: 25.03 },
  "shanghai": { lon: 121.47, lat: 31.23 },
  "beijing": { lon: 116.4, lat: 39.9 },
  "osaka": { lon: 135.5, lat: 34.69 },
  "kyoto": { lon: 135.77, lat: 35.01 },
  "auckland": { lon: 174.76, lat: -36.85 },
  "wellington": { lon: 174.78, lat: -41.29 },
  "santiago": { lon: -70.65, lat: -33.45 },
  "lima": { lon: -77.03, lat: -12.05 },
  "bogotá": { lon: -74.07, lat: 4.71 },
  "bogota": { lon: -74.07, lat: 4.71 },
  "medellín": { lon: -75.57, lat: 6.24 },
  "medellin": { lon: -75.57, lat: 6.24 },
  "quito": { lon: -78.47, lat: -0.18 },
  "caracas": { lon: -66.9, lat: 10.5 },
  "havana": { lon: -82.36, lat: 23.13 },
  "san juan": { lon: -66.11, lat: 18.47 },
  "rio de janeiro": { lon: -43.17, lat: -22.91 },
  "salvador": { lon: -38.5, lat: -12.97 },
  "brasília": { lon: -47.88, lat: -15.79 },
  "brasilia": { lon: -47.88, lat: -15.79 },
  "guadalajara": { lon: -103.35, lat: 20.66 },
  "monterrey": { lon: -100.32, lat: 25.68 },
  "oaxaca": { lon: -96.73, lat: 17.07 },
};

export const KNOWN_CITIES: GlobeCity[] = Object.entries(CITY_COORDS).map(
  ([name, c]) => ({ name: name.replace(/\b\w/g, (s) => s.toUpperCase()), ...c }),
);

function resolveCity(name: string | null | undefined): GlobeCity {
  if (name) {
    const hit = CITY_COORDS[name.trim().toLowerCase()];
    if (hit) return { name, ...hit };
  }
  return KNOWN_CITIES[Math.floor(Math.random() * KNOWN_CITIES.length)];
}

function randomDestination(from: GlobeCity): GlobeCity {
  let dest = KNOWN_CITIES[Math.floor(Math.random() * KNOWN_CITIES.length)];
  let tries = 0;
  while (dest.name === from.name && tries++ < 5) {
    dest = KNOWN_CITIES[Math.floor(Math.random() * KNOWN_CITIES.length)];
  }
  return dest;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchPromos(): Promise<GlobePromo[]> {
  const [worksRes, collabsRes, groupsRes] = await Promise.all([
    supabase
      .from("works")
      .select("slug,title,cities(name)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("collab_posts")
      .select("slug,title,cities(name)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("groups")
      .select("slug,name,cities(name)")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const works: GlobePromo[] = (worksRes.data ?? [])
    .filter((w) => w.slug && w.title)
    .map((w) => {
      const from = resolveCity((w.cities as { name?: string } | null)?.name);
      return {
        kind: "work" as const,
        title: w.title as string,
        href: `/works/${w.slug}`,
        from,
        to: randomDestination(from),
      };
    });

  const collabs: GlobePromo[] = (collabsRes.data ?? [])
    .filter((c) => c.slug && c.title)
    .map((c) => {
      const from = resolveCity((c.cities as { name?: string } | null)?.name);
      return {
        kind: "collab" as const,
        title: c.title as string,
        href: `/collab/${c.slug}`,
        from,
        to: randomDestination(from),
        verb: "Open collab",
      };
    });

  const groups: GlobePromo[] = (groupsRes.data ?? [])
    .filter((g) => g.slug && g.name)
    .map((g) => {
      const from = resolveCity((g.cities as { name?: string } | null)?.name);
      return {
        kind: "group" as const,
        title: g.name as string,
        href: `/g/${g.slug}`,
        from,
      };
    });

  // Weighted mix ~ 3 works : 2 collabs : 1 group.
  const bucket: GlobePromo[] = [];
  const maxLen = Math.max(works.length, collabs.length, groups.length);
  for (let i = 0; i < maxLen; i++) {
    if (works[i]) bucket.push(works[i]);
    if (works[i + 1]) bucket.push(works[i + 1]);
    if (works[i + 2]) bucket.push(works[i + 2]);
    if (collabs[i]) bucket.push(collabs[i]);
    if (collabs[i + 1]) bucket.push(collabs[i + 1]);
    if (groups[i]) bucket.push(groups[i]);
  }
  const seen = new Set<string>();
  const deduped = bucket.filter((p) => {
    const k = `${p.kind}:${p.href}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return shuffle(deduped);
}

export function useGlobePromos() {
  return useQuery({
    queryKey: ["globe-promos"],
    queryFn: fetchPromos,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
