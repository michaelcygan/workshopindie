/**
 * Admin-only seeding of the verified Milwaukee external-events manifest.
 *
 * Thin wrapper: all logic lives in the shared city runner, so Milwaukee and
 * Chicago stay identical in behavior and idempotency guarantees.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MILWAUKEE_GROUP_SLUG,
  MILWAUKEE_SEED_EVENTS,
  MILWAUKEE_TIMEZONE,
} from "./milwaukee-events.data";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

export const seedMilwaukeeEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCitySeed } = await import("./city-events.server");

    return runCitySeed(supabaseAdmin, {
      citySlug: MILWAUKEE_GROUP_SLUG,
      timezone: MILWAUKEE_TIMEZONE,
      events: MILWAUKEE_SEED_EVENTS,
      userId,
    });
  });
