/**
 * Rolling materializer for recurring event series.
 *
 * Public route under /api/public/* — bypasses auth on published sites.
 * Secured with the project's anon/publishable key in the `apikey` header
 * (matches the pg_cron pattern used across this project).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { materializeAllDueSeries } from "@/lib/event-series.server";

async function handler(request: Request) {
  const apiKey = request.headers.get("apikey");
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!apiKey || !expected || apiKey !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    return new Response("Server misconfigured", { status: 500 });
  }
  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const result = await materializeAllDueSeries(admin);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
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
