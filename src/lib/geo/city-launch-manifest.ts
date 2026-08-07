/**
 * One-time administrative launch manifest — Midwest-first US expansion.
 *
 * Pure data. Nothing here is authoritative geography: every entry is only a
 * provider *query* plus the expectations used to validate the provider's
 * answer. Coordinates, slugs, OSM ids and canonical names always come from the
 * place provider.
 */

export type ManifestCity = {
  /** How we ask the provider. */
  query: string;
  /** Requested city label (for reporting). */
  city: string;
  /** Expected state/region — the provider result must match this. */
  state: string;
  /** Acceptable canonical locality names returned by the provider. */
  aliases?: string[];
};

const c = (city: string, state: string, aliases?: string[]): ManifestCity => ({
  query: `${city}, ${state}, United States`,
  city,
  state,
  ...(aliases ? { aliases } : {}),
});

/** Primary targets, in launch order. */
export const PRIMARY_CITIES: ManifestCity[] = [
  c("Milwaukee", "Wisconsin"),
  c("Madison", "Wisconsin"),
  c("Minneapolis", "Minnesota"),
  c("Saint Paul", "Minnesota", ["Saint Paul", "St. Paul", "St Paul"]),
  c("Detroit", "Michigan"),
  c("Ann Arbor", "Michigan"),
  c("Grand Rapids", "Michigan"),
  c("Indianapolis", "Indiana"),
  c("Bloomington", "Indiana"),
  c("Fort Wayne", "Indiana"),
  c("South Bend", "Indiana"),
  c("Columbus", "Ohio"),
  c("Cleveland", "Ohio"),
  c("Cincinnati", "Ohio"),
  c("Akron", "Ohio"),
  c("Toledo", "Ohio"),
  c("St. Louis", "Missouri", ["St. Louis", "Saint Louis", "St Louis"]),
  c("Kansas City", "Missouri"),
  c("Des Moines", "Iowa"),
  c("Iowa City", "Iowa"),
  c("Omaha", "Nebraska"),
  c("Lincoln", "Nebraska"),
  c("Lawrence", "Kansas"),
  c("Wichita", "Kansas"),
  c("Rockford", "Illinois"),
];

/** Used only when a primary already exists or cannot be safely resolved. */
export const RESERVE_CITIES: ManifestCity[] = [
  c("Champaign", "Illinois"),
  c("Peoria", "Illinois"),
  c("Duluth", "Minnesota"),
  c("Green Bay", "Wisconsin"),
  c("Lansing", "Michigan"),
  c("Dayton", "Ohio"),
  c("Cedar Rapids", "Iowa"),
  c("Springfield", "Missouri"),
  c("Fargo", "North Dakota"),
  c("Sioux Falls", "South Dakota"),
  c("Louisville", "Kentucky"),
  c("Pittsburgh", "Pennsylvania"),
  c("Lexington", "Kentucky"),
];

/** Full walk order: primaries first, reserves as fallback. */
export const LAUNCH_MANIFEST: ManifestCity[] = [...PRIMARY_CITIES, ...RESERVE_CITIES];

export const PRIMARY_COUNT = PRIMARY_CITIES.length;

/** Net-new localities this operation intends to create. */
export const TARGET_NEW_CITIES = 25;

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Does a provider result satisfy the manifest entry's expectations? */
export function matchesManifest(
  entry: ManifestCity,
  place: { name: string; stateRegion: string | null; countryCode: string | null },
): boolean {
  if (place.countryCode !== "US") return false;
  if (!place.stateRegion) return false;
  if (norm(place.stateRegion) !== norm(entry.state)) return false;
  const accepted = [entry.city, ...(entry.aliases ?? [])].map(norm);
  return accepted.includes(norm(place.name));
}
