/**
 * Tracking links — shared, client-safe helpers.
 *
 * A tracking link is a named Workshop URL (`/go/<slug>`) used on posters, QR
 * codes, NFC cards, flyers and social bios. The name records *where* the link
 * was placed; the clicks tell us whether that placement worked.
 *
 * Deliberately separate from `/w/:token` Workshop-room links and from group
 * seed links. Nothing here reads or writes those systems.
 */

/** Hosts we treat as "this is a Workshop URL, keep the path". */
const WORKSHOP_HOSTS = new Set([
  "workshopindie.com",
  "www.workshopindie.com",
  "workshopindie.lovable.app",
]);

export const TRACKING_LINK_NAME_MAX = 120;
export const TRACKING_LINK_SLUG_MAX = 80;

/** lowercase, hyphenated, no runs, no edges, ascii only. */
export function slugifyTrackingLink(raw: string): string {
  return (raw ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, TRACKING_LINK_SLUG_MAX)
    .replace(/-$/, "");
}

export function isValidTrackingSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= TRACKING_LINK_SLUG_MAX;
}

export type DestinationResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

/**
 * Accepts an internal path (`/events`) or a full Workshop URL and returns the
 * normalized internal path. Everything else is rejected — this must never
 * become an open redirect, and it must never point back at `/go/...`.
 */
export function normalizeDestination(raw: string): DestinationResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, message: "Destination is required." };
  if (trimmed.length > 500) return { ok: false, message: "That destination is too long." };

  let path = trimmed;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    // Absolute URL: only Workshop's own hosts survive.
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, message: "That doesn't look like a Workshop URL." };
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, message: "Only Workshop web addresses are allowed." };
    }
    if (!WORKSHOP_HOSTS.has(url.hostname.toLowerCase())) {
      return { ok: false, message: "Destinations must be Workshop pages, not outside sites." };
    }
    path = `${url.pathname}${url.search}${url.hash}`;
  } else if (/^\/\//.test(trimmed)) {
    // Protocol-relative — a classic open-redirect vector.
    return { ok: false, message: "Destinations must be Workshop pages, not outside sites." };
  } else if (!trimmed.startsWith("/")) {
    path = `/${trimmed}`;
  }

  // Collapse accidental duplicate slashes after the leading one.
  path = `/${path.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
  if (path !== "/" ) path = path.replace(/\/(?=$)/, "") || "/";

  if (/^\/go(\/|$)/.test(path)) {
    return { ok: false, message: "A tracking link can't point at another tracking link." };
  }
  if (/[\s<>"'`\\]/.test(path)) {
    return { ok: false, message: "That destination contains characters Workshop can't route." };
  }
  return { ok: true, path };
}

/** Public URL for a tracking link, absolute in the browser. */
export function trackingLinkUrl(slug: string, origin?: string): string {
  const base = origin ?? (typeof window === "undefined" ? "" : window.location.origin);
  return `${base}/go/${slug}`;
}

/** Display form for a click's coarse location; never fabricates one. */
export function formatClickLocation(
  city?: string | null,
  region?: string | null,
  country?: string | null,
): string {
  const parts = [city, region, country].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length ? parts.join(", ") : "Unknown";
}

/** Query param carrying a click id through the redirect for member attribution. */
export const TRACKING_CLICK_PARAM = "wtl";
