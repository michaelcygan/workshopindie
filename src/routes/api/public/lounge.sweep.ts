import { createFileRoute } from "@tanstack/react-router";
import { requireCronSecret } from "@/lib/cron-auth";

/**
 * Lounge audio sweep — pg_cron POSTs every minute.
 *
 * Calls `sweep_stale_lounge_speakers()` which flips any speaker/offered/waiting
 * presence row that hasn't heartbeat-ed in 60s back to listener, freeing up
 * mic seats abandoned by tab-closed / network-dropped clients.
 */
export const Route = createFileRoute("/api/public/lounge/sweep")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireCronSecret(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc(
          "sweep_stale_lounge_speakers",
        );
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, reclaimed: data ?? 0 });
      },
    },
  },
});
