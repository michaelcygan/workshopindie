/**
 * Idempotent seeding of the verified Chicago recurring-events manifest.
 *
 * Admin-only. Every seeded row is external provenance: Workshop is listing a
 * real event that someone else organizes, never claiming it as its own.
 *
 * Idempotency:
 *  - Weekly entries create one `event_series` row keyed by the manifest `key`
 *    (unique constraint on `series_key`), then materialize occurrences.
 *  - Dated entries insert `group_events` rows directly; the unique index on
 *    (series_key, starts_at) makes re-running a no-op.
 * Re-running updates the stored template so manifest copy fixes reach future
 * occurrences, and never duplicates anything.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CHICAGO_GROUP_SLUG,
  CHICAGO_SEED_EVENTS,
  CHICAGO_TIMEZONE,
} from "./chicago-events.data";

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Admin only");
}

export const seedChicagoEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runCitySeed } = await import("./city-events.server");

    return runCitySeed(supabaseAdmin, {
      citySlug: CHICAGO_GROUP_SLUG,
      timezone: CHICAGO_TIMEZONE,
      events: CHICAGO_SEED_EVENTS,
      userId,
    });
  });

