/**
 * One shared same-origin destination validator.
 *
 * Every post-auth redirect (login ?redirect=, signup ?redirect=, OAuth pending
 * destination, email confirmation, /me/edit ?next=, stored post-auth intents)
 * runs through this. It accepts a same-origin *path* only and preserves the
 * query string and hash.
 *
 * Rejected: absolute URLs, protocol-relative "//host", backslash tricks,
 * control characters, malformed percent-encoding, anything that resolves to a
 * different origin.
 */

const DEFAULT_DESTINATION = "/";

/** Origin used when resolving. Falls back to a dummy origin during SSR. */
function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "https://workshop.invalid";
}

/**
 * Returns a safe same-origin path (with optional search + hash), or null when
 * the input is missing or unsafe.
 */
export function safeDestination(input?: string | null): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Control characters (incl. \t \n \r, which browsers strip before parsing).
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;

  // Backslashes are treated as slashes by browsers: "/\evil.example".
  if (raw.includes("\\")) return null;

  // Must be a rooted path. Rejects "https://…", "javascript:…", "evil".
  if (!raw.startsWith("/")) return null;

  // Protocol-relative.
  if (raw.startsWith("//")) return null;

  // Malformed percent-encoding.
  try {
    decodeURIComponent(raw);
  } catch {
    return null;
  }

  const origin = currentOrigin();
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!url.pathname.startsWith("/")) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** Same as safeDestination but always returns a usable path ("/" fallback). */
export function safeDestinationOrHome(input?: string | null): string {
  return safeDestination(input) ?? DEFAULT_DESTINATION;
}

/** Absolute same-origin URL for a validated path — used as an OAuth return URL. */
export function absoluteSafeUrl(path?: string | null): string {
  const origin = currentOrigin();
  return origin + safeDestinationOrHome(path);
}
