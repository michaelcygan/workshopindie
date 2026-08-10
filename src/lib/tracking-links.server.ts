import {
  coarseGeoFromHeaders,
  isLikelyBot,
  measurementAdminClient,
  referrerHost,
} from "@/lib/analytics/request.server";

/**
 * Server-only recording for the `/go/<slug>` redirect.
 *
 * Privacy posture and the helpers behind it are shared with the rest of the
 * first-party measurement surfaces — see @/lib/analytics/request.server.
 */

export { coarseGeoFromHeaders, isLikelyBot, referrerHost };

export type TrackingResolution =
  | { kind: "redirect"; destination: string; clickId: string | null }
  | { kind: "missing" }
  | { kind: "disabled" };

/**
 * Resolve the slug and record one click. Recording must never block or break
 * the redirect: any failure here still sends the visitor to the destination.
 */
export async function resolveAndRecord(
  slug: string,
  headers: Headers,
): Promise<TrackingResolution> {
  const admin = measurementAdminClient();
  if (!admin) return { kind: "missing" };

  const { data: link, error } = await admin
    .from("tracking_links")
    .select("id,destination_path,is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) console.error(`[tracking-links] lookup failed slug=${slug}: ${error.message}`);
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
