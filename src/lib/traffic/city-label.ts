/**
 * Honest city labels for coarse edge geography.
 *
 * A country code is not a city. When the edge gave us a country but no city,
 * say so ("Unknown (US)") rather than dressing the country up as a place.
 */
export function cityLabel(
  city: string | null | undefined,
  region: string | null | undefined,
  country: string | null | undefined,
): string {
  const c = (city ?? "").trim();
  if (c) {
    const r = (region ?? "").trim();
    return r ? `${c}, ${r}` : c;
  }
  const co = (country ?? "").trim();
  return co ? `Unknown (${co})` : "Unknown";
}

/** True for rows with no city — sorted after known cities. */
export function isUnknownCity(city: string | null | undefined): boolean {
  return !(city ?? "").trim();
}
