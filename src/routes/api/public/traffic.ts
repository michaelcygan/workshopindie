import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isExcludedTrafficPath, normalizeTrafficPath } from "@/lib/traffic/shared";

/**
 * First-party traffic ingestion.
 *
 * The browser supplies only its anonymous ids, the pathname and whether it is
 * a member or a guest. Geography and referrer are derived server-side from the
 * edge request — the client is never authoritative about where it is. Nothing
 * here identifies a person: no IP, no user id, no query string, no full URL.
 *
 * Measurement is best effort. Every failure path still returns 204 so a broken
 * analytics write can never surface to a visitor.
 */

const Body = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  path: z.string().min(1).max(1024),
  routePattern: z.string().max(512).nullish(),
  visitorType: z.enum(["guest", "member"]).default("guest"),
  /** Hostname only, taken from document.referrer by the tracker. */
  referrerHost: z.string().max(120).nullish(),
});

const NO_CONTENT = { status: 204, headers: { "Cache-Control": "no-store" } } as const;

export const Route = createFileRoute("/api/public/traffic")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { coarseGeoFromRequest, isLikelyBot, measurementAdminClient, referrerHost } =
            await import("@/lib/analytics/request.server");

          if (isLikelyBot(request.headers.get("user-agent"))) return new Response(null, NO_CONTENT);

          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response(null, NO_CONTENT);

          const path = normalizeTrafficPath(parsed.data.path);
          if (!path || isExcludedTrafficPath(path)) return new Response(null, NO_CONTENT);

          const admin = measurementAdminClient();
          if (!admin) return new Response(null, NO_CONTENT);

          // The fetch's own Referer header is always this site, so the entry
          // referrer comes from the document. Only a hostname is accepted and
          // it is re-validated here; internal navigation is not a source.
          const claimed = (parsed.data.referrerHost ?? "").toLowerCase().trim();
          const host = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(claimed)
            ? claimed
            : referrerHost(request.headers.get("referer"));
          const self = new URL(request.url).hostname.toLowerCase();
          // Preview/editor hosts are Workshop looking at itself, not acquisition.
          const INTERNAL = ["lovable.app", "lovableproject.com", "workshopindie.com", "localhost"];
          const external =
            host && host !== self && !INTERNAL.some((h) => host === h || host.endsWith(`.${h}`))
              ? host
              : null;

          const geo = coarseGeoFromRequest(request);

          await admin.from("traffic_pageviews").insert({
            visitor_id: parsed.data.visitorId,
            session_id: parsed.data.sessionId,
            path,
            route_pattern: parsed.data.routePattern ?? null,
            visitor_type: parsed.data.visitorType,
            referrer: external,
            city: geo.city,
            region: geo.region,
            country: geo.country,
          });
        } catch {
          // Never let measurement failure reach the visitor.
        }
        return new Response(null, NO_CONTENT);
      },
    },
  },
});
