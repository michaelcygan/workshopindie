import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared server-side measurement helpers.
 *
 * One implementation of the privacy posture used by every first-party
 * measurement surface (tracking links, traffic pageviews): coarse city /
 * region / country from edge request headers, referring host only, shallow
 * bot filtering. No IP address, no user id, no fingerprint, no full URL.
 */

/** Service-role client for measurement writes. Null when env is missing. */
export function measurementAdminClient(): SupabaseClient | null {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Obvious non-humans. Deliberately shallow — this is not fraud detection. */
const BOT_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|uptime|curl|wget|python-requests|node-fetch|headless|lighthouse|pingdom|healthcheck|axios|okhttp/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // no UA at all is a script or a health check
  return BOT_RE.test(userAgent);
}

/** Referring host only ("instagram.com"), never a full URL with its path. */
export function referrerHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const host = new URL(referer).hostname.toLowerCase();
    return host ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

function clean(v: string | null | undefined, max = 120): string | null {
  const t = (v ?? "").trim();
  if (!t || t === "-" || t.toUpperCase() === "XX") return null;
  return decodeURIComponent(t).slice(0, max);
}

/**
 * Coarse geography from the edge. Cloudflare supplies these on the request; we
 * never call a paid geolocation service and never guess. Unknown stays null.
 */
export function coarseGeoFromHeaders(headers: Headers): {
  city: string | null;
  region: string | null;
  country: string | null;
} {
  return {
    city: clean(headers.get("cf-ipcity")),
    region: clean(headers.get("cf-region") ?? headers.get("cf-region-code")),
    country: clean(headers.get("cf-ipcountry"), 8)?.toUpperCase() ?? null,
  };
}
