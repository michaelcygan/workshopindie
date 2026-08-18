/**
 * Rolling materializer for recurring event series AND Workshop event programs.
 *
 * Public route under /api/public/* — bypasses site auth on published sites,
 * so it is secured with the shared cron secret (`x-cron-secret`). A Supabase
 * publishable key is NOT a cron secret and is no longer accepted.
 *
 * Both sweeps run on the same schedule and report separately. A failure in
 * one never prevents the other from running.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireCronSecret } from "@/lib/cron-auth";

async function handler(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let series: unknown = null;
  let seriesError: string | null = null;
  try {
    const { materializeAllDueSeries } = await import("@/lib/event-series.server");
    series = await materializeAllDueSeries(supabaseAdmin);
  } catch (e) {
    seriesError = (e as Error).message;
  }

  let programs: unknown = null;
  let programsError: string | null = null;
  try {
    const { materializeAllPrograms } = await import("@/lib/events/workshop-programs.server");
    programs = await materializeAllPrograms(supabaseAdmin);
  } catch (e) {
    programsError = (e as Error).message;
  }

  const ok = !seriesError && !programsError;
  return Response.json(
    { ok, series, seriesError, programs, programsError },
    { status: ok ? 200 : 500 },
  );
}


export const Route = createFileRoute("/api/public/events/materialize")({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
    },
  },
});
