import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only recording for the `/go/<slug>` redirect.
 *
 * Privacy posture: we store whether the visitor was a member or a guest, a
 * coarse city/region/country when the edge already knows it, and the referring
 * host. No IP address, no user id, no fingerprint, no per-person history.
 */

export type TrackingResolution =
  | { kind: "redirect"; destination: string; clickId: string | null }
  | { kind: "missing" }
  | { kind: "disabled" };

function adminClient(): SupabaseClient | null {
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

/** Obvious non-humans. Deliberately shallow — V1 counts redirect requests. */
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

/**
 * Resolve the slug and record one click. Recording must never block or break
 * the redirect: any failure here still sends the visitor to the destination.
 */
export async function resolveAndRecord(
  slug: string,
  headers: Headers,
): Promise<TrackingResolution> {
  const admin = adminClient();
  if (!admin) return { kind: "missing" };

  const { data: link, error } = await admin
    .from("tracking_links")
    .select("id,destination_path,is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !link) return { kind: "missing" };
  if (!link.is_active) return { kind: "disabled" };

  if (isLikelyBot(headers.get("user-agent"))) {
    return { kind: "redirect", destination: link.destination_path, clickId: null };
  }

  const geo = coarseGeoFromHeaders(headers);
  let clickId: string | null = null;
  try {
    const { data: click } = await admin
      .from("tracking_link_clicks")
      .insert({
        tracking_link_id: link.id,
        visitor_type: "guest",
        city: geo.city,
        region: geo.region,
        country: geo.country,
        referrer: referrerHost(headers.get("referer")),
      })
      .select("id")
      .single();
    clickId = click?.id ?? null;
  } catch {
    // A measurement failure is never worth a broken promotional link.
  }

  return { kind: "redirect", destination: link.destination_path, clickId };
}
