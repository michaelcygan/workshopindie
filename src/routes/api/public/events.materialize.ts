/**
 * Rolling materializer for recurring event series.
 *
 * Public route under /api/public/* — bypasses site auth on published sites,
 * so it is secured with the shared cron secret (`x-cron-secret`). A Supabase
 * publishable key is NOT a cron secret and is no longer accepted.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireCronSecret } from "@/lib/cron-auth";

async function handler(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { materializeAllDueSeries } = await import("@/lib/event-series.server");
    const result = await materializeAllDueSeries(supabaseAdmin);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/events/materialize")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
    },
  },
});
