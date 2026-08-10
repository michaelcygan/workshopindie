/**
 * Client-safe traffic measurement rules.
 *
 * These are shared by the browser tracker and the ingestion endpoint so the
 * two can never disagree about what counts as a recordable page view.
 */

export const TRAFFIC_VISITOR_KEY = "workshop_visitor_id";
export const TRAFFIC_SESSION_KEY = "workshop_traffic_session";
export const TRAFFIC_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const TRAFFIC_ENDPOINT = "/api/public/traffic";

/**
 * Private, operational or credential-bearing surfaces. Traffic analytics is
 * about public navigation, not about what a signed-in person reads in their
 * inbox — and never about a path that may carry a token.
 */
const EXCLUDED_PREFIXES = [
  "/admin",
  "/dms",
  "/settings",
  "/auth",
  "/api",
  "/go/", // the tracking-link redirect is its own measurement, never a page view
  "/reset-password",
  "/forgot-password",
  "/verify",
  "/invite",
  "/join/",
  "/oauth",
];

const EXCLUDED_EXACT = new Set(["/reset-password", "/forgot-password", "/settings", "/logout"]);

/** Pathname only: no query string, no hash, no trailing slash noise. */
export function normalizeTrafficPath(input: string): string | null {
  if (!input) return null;
  let path = input;
  const q = path.search(/[?#]/);
  if (q >= 0) path = path.slice(0, q);
  if (!path.startsWith("/")) return null;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  if (path.length > 512) return null;
  return path;
}

export function isExcludedTrafficPath(path: string): boolean {
  if (EXCLUDED_EXACT.has(path)) return true;
  return EXCLUDED_PREFIXES.some((p) => path === p.replace(/\/$/, "") || path.startsWith(p));
}

/** A route pattern like `/blog/$slug` normalized to `/blog/:slug`. */
export function normalizeRoutePattern(routeId: string | null | undefined): string | null {
  if (!routeId) return null;
  const cleaned = routeId
    .replace(/\/_[^/]+/g, "") // pathless layouts
    .replace(/\$([A-Za-z0-9_]+)/g, ":$1")
    .replace(/\$$/, ":splat")
    .replace(/\/+$/, "");
  const out = cleaned === "" ? "/" : cleaned;
  if (!out.startsWith("/")) return null;
  return out.slice(0, 512);
}
