import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isExcludedTrafficPath, normalizeTrafficPath } from "@/lib/traffic/shared";

/**
 * Anonymous live-presence heartbeat.
 *
 * One row per anonymous analytics session holding only "this tab is visible,
 * on this page, right now". No user id, no IP, no fingerprint, no query
 * string. Geography still comes from the edge request, never from the client.
 *
 * Rows are never read by the app — only the admin snapshot aggregate reads
 * them. Like every measurement surface here, all failure paths return 204.
 */

const Body = z.object({
  sessionId: z.string().uuid(),
  path: z.string().min(1).max(1024),
  visitorType: z.enum(["guest", "member"]).default("guest"),
  source: z.string().max(120).nullish(),
});

const NO_CONTENT = { status: 204, headers: { "Cache-Control": "no-store" } } as const;

export const Route = createFileRoute("/api/public/traffic/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { coarseGeoFromHeaders, isLikelyBot, measurementAdminClient } = await import(
            "@/lib/analytics/request.server"
          );

          if (isLikelyBot(request.headers.get("user-agent"))) return new Response(null, NO_CONTENT);

          const parsed = Body.safeParse(await request.json());
          if (!parsed.success) return new Response(null, NO_CONTENT);

          const path = normalizeTrafficPath(parsed.data.path);
          if (!path || isExcludedTrafficPath(path)) return new Response(null, NO_CONTENT);

          const admin = measurementAdminClient();
          if (!admin) return new Response(null, NO_CONTENT);

          const claimed = (parsed.data.source ?? "").toLowerCase().trim();
          const self = new URL(request.url).hostname.toLowerCase();
          const INTERNAL = ["lovable.app", "lovableproject.com", "workshopindie.com", "localhost"];
          const source =
            /^[a-z0-9.-]+\.[a-z]{2,}$/.test(claimed) &&
            claimed !== self &&
            !INTERNAL.some((h) => claimed === h || claimed.endsWith(`.${h}`))
              ? claimed
              : null;

          const geo = coarseGeoFromHeaders(request.headers);

          await admin.from("traffic_live_sessions").upsert(
            {
              session_id: parsed.data.sessionId,
              visitor_type: parsed.data.visitorType,
              path,
              city: geo.city,
              region: geo.region,
              country: geo.country,
              source,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "session_id" },
          );

          // Occasional, opportunistic sweep. Stale rows already fail the live
          // window, so this is housekeeping, not correctness.
          if (Math.random() < 0.01) {
            await admin
              .from("traffic_live_sessions")
              .delete()
              .lt("last_seen_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
          }
        } catch {
          // Never let measurement failure reach the visitor.
        }
        return new Response(null, NO_CONTENT);
      },
    },
  },
});
