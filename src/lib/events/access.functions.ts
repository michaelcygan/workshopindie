import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EventAccess } from "@/lib/events/access-types";

/**
 * Server-resolved access for a signed-in viewer. Signed-out viewers never call
 * this — they get the public flyer only, and every mutation re-resolves access
 * server-side regardless of what the client believes.
 */
export const getMyEventAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ event_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<EventAccess | null> => {
    const { supabase, userId } = context;
    const { loadEventAccessRow, resolveEventAccess } = await import("@/lib/events/access.server");
    const row = await loadEventAccessRow(supabase, data.event_id);
    if (!row || row.deleted_at) return null;
    const access = await resolveEventAccess(supabase, row, userId);
    return access.canSeeEvent ? access : null;
  });
