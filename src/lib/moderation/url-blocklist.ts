// Browser-safe curated URL blocklist for Lounge chat.
// Kept small and conservative — only well-known adult/extremist hubs.
// No live feeds, no network calls; safe to import from client + edge.

/** Exact hosts (post www-strip, lowercased). */
export const BLOCKED_HOSTS: ReadonlySet<string> = new Set([
  // Adult
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "youporn.com",
  "spankbang.com",
  "tnaflix.com",
  "brazzers.com",
  "onlyfans.com",
  "fansly.com",
  "chaturbate.com",
  "stripchat.com",
  "cam4.com",
  "myfreecams.com",
  "livejasmin.com",
  "adultfriendfinder.com",
  "clips4sale.com",
  "manyvids.com",
  "eporner.com",
  // Hate / extremist hubs
  "stormfront.org",
  "dailystormer.com",
  "dailystormer.name",
  "dailystormer.su",
  "kiwifarms.net",
  "kiwifarms.st",
  "kiwifarms.cc",
  "ironmarch.org",
  "vanguardnewsnetwork.com",
  "vdare.com",
  "occidentaldissent.com",
  "renegadetribune.com",
  "amren.com",
  "americanrenaissance.com",
  "bitchute.com/hashtag/hitler",
]);

/**
 * Host suffixes — matched as ".suffix" against the normalized host so
 * subdomains are covered but unrelated hosts that merely end in the string
 * are not. E.g. "pornhub.com" also blocks "de.pornhub.com".
 */
export const BLOCKED_HOST_SUFFIXES: readonly string[] = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "youporn.com",
  "spankbang.com",
  "onlyfans.com",
  "fansly.com",
  "chaturbate.com",
  "stripchat.com",
  "stormfront.org",
  "dailystormer.com",
  "dailystormer.name",
  "dailystormer.su",
  "kiwifarms.net",
  "kiwifarms.st",
  "kiwifarms.cc",
];

const URL_RE = /\bhttps?:\/\/[^\s<>()"']+/gi;

/** Extract raw URL strings from a message body. */
export function extractUrls(body: string): string[] {
  if (!body) return [];
  const out = body.match(URL_RE) ?? [];
  // Trim trailing punctuation commonly glued to URLs in prose.
  return out.map((u) => u.replace(/[),.;!?]+$/g, ""));
}

function normalizeHost(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when the URL points at a curated blocked host. */
export function isBlockedUrl(url: string): boolean {
  const host = normalizeHost(url);
  if (!host) return false;
  if (BLOCKED_HOSTS.has(host)) return true;
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host === suffix || host.endsWith("." + suffix)) return true;
  }
  return false;
}

/** Return the first blocked URL in a body, or null. */
export function findBlockedUrl(body: string): string | null {
  for (const u of extractUrls(body)) {
    if (isBlockedUrl(u)) return u;
  }
  return null;
}
