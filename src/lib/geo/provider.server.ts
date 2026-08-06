/**
 * Worldwide place provider — server only.
 *
 * Kept behind this small abstraction so the UI and the database never couple
 * to a specific vendor. Today: OpenStreetMap / Nominatim.
 *
 * Provider identity is `<TypeInitial><osmId>` (e.g. "N240109189"), which is
 * exactly what Nominatim's /lookup endpoint accepts, so any place we store can
 * always be re-resolved and re-verified server-side.
 */

export const PLACE_PROVIDER = "osm" as const;

export type CanonicalPlace = {
  provider: typeof PLACE_PROVIDER;
  providerId: string;
  name: string;
  stateRegion: string | null;
  country: string;
  countryCode: string | null;
  locationKind: string;
  latitude: number | null;
  longitude: number | null;
  /** "Chicago · Illinois, United States" style label parts. */
  label: string;
  sublabel: string;
};

/** Place types we consider a groupable locality (never venues, POIs, addresses). */
const GROUPABLE_KINDS = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "borough",
  "city_district",
  "locality",
  "hamlet",
  "suburb",
]);

type NominatimAddress = Record<string, string | undefined>;

type NominatimResult = {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
};

const UA = "WorkshopIndie/1.0 (https://workshopindie.com)";

function providerIdFor(r: NominatimResult): string | null {
  const t = (r.osm_type ?? "").toLowerCase();
  const initial = t === "node" ? "N" : t === "way" ? "W" : t === "relation" ? "R" : null;
  if (!initial || !r.osm_id) return null;
  return `${initial}${r.osm_id}`;
}

function localityName(r: NominatimResult): string | null {
  const a = r.address ?? {};
  return (
    r.name ||
    a["city"] ||
    a["town"] ||
    a["village"] ||
    a["municipality"] ||
    a["borough"] ||
    a["hamlet"] ||
    (r.display_name ? r.display_name.split(",")[0]?.trim() : null) ||
    null
  );
}

function regionOf(a: NominatimAddress): string | null {
  return a["state"] || a["region"] || a["province"] || a["county"] || a["state_district"] || null;
}

function toCanonical(r: NominatimResult): CanonicalPlace | null {
  const kind = (r.addresstype || r.type || "").toLowerCase();
  if (!GROUPABLE_KINDS.has(kind)) return null;

  const providerId = providerIdFor(r);
  const name = localityName(r);
  const a = r.address ?? {};
  const country = a["country"] ?? null;
  if (!providerId || !name || !country) return null;

  const region = regionOf(a);
  const cc = (a["country_code"] ?? "").toUpperCase() || null;
  const lat = r.lat ? Number(r.lat) : null;
  const lng = r.lon ? Number(r.lon) : null;

  return {
    provider: PLACE_PROVIDER,
    providerId,
    name,
    stateRegion: region,
    country,
    countryCode: cc && /^[A-Z]{2}$/.test(cc) ? cc : null,
    locationKind: kind,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    label: name,
    sublabel: [region, country].filter(Boolean).join(", "),
  };
}

async function getJson(url: URL, acceptLanguage?: string): Promise<NominatimResult[]> {
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Accept-Language": acceptLanguage || "en",
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return Array.isArray(json) ? (json as NominatimResult[]) : [json as NominatimResult];
}

/** Free-text worldwide locality search. Unicode friendly. Never writes anything. */
export async function searchProviderLocalities(
  query: string,
  opts: { limit?: number; acceptLanguage?: string } = {},
): Promise<CanonicalPlace[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(Math.min(opts.limit ?? 8, 15)));
  url.searchParams.set("featureType", "settlement");

  try {
    const rows = await getJson(url, opts.acceptLanguage);
    const out: CanonicalPlace[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const place = toCanonical(r);
      if (!place || seen.has(place.providerId)) continue;
      seen.add(place.providerId);
      out.push(place);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Authoritative re-resolution of a provider identity. This is what makes
 * provisioning safe: the client only ever sends an identity, never metadata.
 */
export async function resolveProviderPlace(providerId: string): Promise<CanonicalPlace | null> {
  if (!/^[NWR]\d{1,20}$/.test(providerId)) return null;
  const url = new URL("https://nominatim.openstreetmap.org/lookup");
  url.searchParams.set("osm_ids", providerId);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  try {
    const rows = await getJson(url);
    for (const r of rows) {
      const place = toCanonical(r);
      if (place) return place;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Server-derived locality for a coordinate. Used when the client picks a venue
 * (a POI, not a locality) and Workshop must decide which city that venue is in
 * without trusting browser-supplied place metadata.
 */
export async function reverseProviderLocality(
  lat: number,
  lng: number,
): Promise<CanonicalPlace | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  // zoom 10 asks Nominatim for the enclosing city/town rather than the POI.
  url.searchParams.set("zoom", "10");
  try {
    const rows = await getJson(url);
    for (const r of rows) {
      const place = toCanonical(r);
      if (place) return place;
    }
    return null;
  } catch {
    return null;
  }
}
