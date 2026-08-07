/**
 * One-time administrative runner for the Milwaukee events seed.
 *
 * Drives the same shared city runner the admin server function uses, so a
 * rerun is always idempotent: series are keyed by `series_key`, dated
 * occurrences by (series_key, starts_at).
 *
 * Usage: bun scripts/seed/run-milwaukee-events.ts
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCitySeed } from "@/lib/seed/city-events.server";
import {
  MILWAUKEE_GROUP_SLUG,
  MILWAUKEE_SEED_EVENTS,
  MILWAUKEE_TIMEZONE,
} from "@/lib/seed/milwaukee-events.data";

async function adminUserId(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const id = data?.[0]?.user_id;
  if (!id) throw new Error("No Workshop admin found — cannot run an admin operation.");
  return id;
}

async function main() {
  const userId = await adminUserId();
  const { results } = await runCitySeed(supabaseAdmin, {
    citySlug: MILWAUKEE_GROUP_SLUG,
    timezone: MILWAUKEE_TIMEZONE,
    events: MILWAUKEE_SEED_EVENTS,
    userId,
  });

  let added = 0;
  for (const r of results) {
    added += r.occurrences_added;
    console.log(`${r.action.padEnd(9)} +${String(r.occurrences_added).padStart(2)}  ${r.title}`);
  }
  console.log(`\n${results.length} manifest entries, ${added} occurrences added.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
