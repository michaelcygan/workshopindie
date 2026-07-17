// Shared URL normalization. Prepends https:// to bare/www URLs and validates.

function stripTrail(u: string): string {
  return u.replace(/[),.;!?]+$/g, "");
}

/** Returns a fully-qualified https(s) URL string, or null if the input can't be normalized. */
export function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  const trimmed = stripTrail(raw.trim());
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** onBlur-friendly: returns the normalized URL if valid, otherwise the trimmed original. */
export function normalizeUrlOrKeep(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return normalizeUrl(trimmed) ?? trimmed;
}
