/**
 * Durable, collision-safe URL slugs for localities.
 *
 * Plain name first (chicago, paris, sao-paulo). Only when that is taken do we
 * disambiguate — regional abbreviation, then country code
 * (cambridge-ma, cambridge-uk). The slug is never the identity.
 */

const US_STATES: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
};

/** Country codes whose common URL form differs from the ISO code. */
const COUNTRY_SLUG_ALIAS: Record<string, string> = { GB: "uk" };

export function slugifyPlace(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ø]/gi, "o")
    .replace(/[đ]/gi, "d")
    .replace(/[ł]/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugCandidates(place: {
  name: string;
  stateRegion?: string | null;
  countryCode?: string | null;
}): string[] {
  const base = slugifyPlace(place.name) || "city";
  const out = [base];

  const region = (place.stateRegion ?? "").trim().toLowerCase();
  const cc = (place.countryCode ?? "").toUpperCase();

  if (cc === "US" && region && US_STATES[region]) {
    out.push(`${base}-${US_STATES[region]}`);
  }
  if (cc) {
    out.push(`${base}-${COUNTRY_SLUG_ALIAS[cc] ?? cc.toLowerCase()}`);
  }
  if (region) {
    const rs = slugifyPlace(region);
    if (rs) out.push(`${base}-${rs}`);
  }

  return Array.from(new Set(out.filter(Boolean)));
}
