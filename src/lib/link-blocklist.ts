// Hosts blocked from being clickable in user-generated chat surfaces.
// Match is host suffix (case-insensitive), so "m.pornhub.com" still matches "pornhub.com".
const BLOCKED_HOSTS: readonly string[] = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "redtube.com",
  "youporn.com",
  "xhamster.com",
  "spankbang.com",
  "onlyfans.com",
  "fansly.com",
  "chaturbate.com",
  "stripchat.com",
  "cam4.com",
  "myfreecams.com",
];

// Common URL shorteners — kept clickable but flagged.
const SHORTENER_HOSTS: readonly string[] = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "shorturl.at",
  "cutt.ly",
];

function hostMatches(host: string, list: readonly string[]): boolean {
  const h = host.toLowerCase();
  return list.some((b) => h === b || h.endsWith(`.${b}`));
}

export function isBlockedHost(host: string): boolean {
  return hostMatches(host, BLOCKED_HOSTS);
}

export function isShortenerHost(host: string): boolean {
  return hostMatches(host, SHORTENER_HOSTS);
}
