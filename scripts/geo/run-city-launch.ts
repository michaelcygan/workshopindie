/**
 * One-time administrative runner for the Midwest-first city launch.
 *
 * Drives the exact same primitives as /admin/geo → Launch queue:
 * provider search → queue upsert → resolveProviderPlace → ensureLocalityFromPlace.
 * No city rows are ever inserted directly.
 *
 * Usage: bun scripts/geo/run-city-launch.ts
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  PLACE_PROVIDER,
  resolveProviderPlace,
  searchProviderLocalities,
} from "@/lib/geo/provider.server";
import { ensureLocalityFromPlace } from "@/lib/geo/provision.server";
import { LAUNCH_MANIFEST, TARGET_NEW_CITIES, matchesManifest } from "@/lib/geo/city-launch-manifest";

const GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

type Row = {
  requested: string;
  state: string;
  canonical: string | null;
  providerId: string | null;
  created: boolean;
  cityId: string | null;
  citySlug: string | null;
  groupId: string | null;
  groupSlug: string | null;
  queueStatus: string;
  note: string;
};

async function main() {
  const userId = await adminUserId();
  const rows: Row[] = [];
  let created = 0; // manifest slots filled (new or already existing)

  for (const entry of LAUNCH_MANIFEST) {
    if (created >= TARGET_NEW_CITIES) break;
    const base: Row = {
      requested: entry.city,
      state: entry.state,
      canonical: null,
      providerId: null,
      created: false,
      cityId: null,
      citySlug: null,
      groupId: null,
      groupSlug: null,
      queueStatus: "—",
      note: "",
    };

    await sleep(GAP_MS);
    const candidates = await searchProviderLocalities(entry.query, { limit: 8 });
    const match = candidates.find((p) => matchesManifest(entry, p));
    if (!match) {
      rows.push({ ...base, note: "No matching provider locality" });
      continue;
    }

    // Queue exactly as the admin console does.
    const displayName = match.sublabel ? `${match.name}, ${match.sublabel}` : match.name;
    const { data: queued, error: qErr } = await supabaseAdmin
      .from("city_launch_queue")
      .upsert(
        {
          place_provider: PLACE_PROVIDER,
          place_provider_id: match.providerId,
          display_name: displayName,
          payload: { country_code: match.countryCode, kind: match.locationKind },
          status: "queued",
          error: null,
          queued_by: userId,
        },
        { onConflict: "place_provider,place_provider_id" },
      )
      .select("id")
      .single();
    if (qErr || !queued) {
      rows.push({ ...base, canonical: match.name, providerId: match.providerId, note: `Queue failed: ${qErr?.message}` });
      continue;
    }

    await sleep(GAP_MS);
    try {
      const place = await resolveProviderPlace(match.providerId);
      if (!place) throw new Error("Place could not be verified");
      const ensured = await ensureLocalityFromPlace({ place, userId, isAdmin: true, join: false });
      await supabaseAdmin
        .from("city_launch_queue")
        .update({ status: "launched", city_id: ensured.cityId, error: null })
        .eq("id", queued.id);
      // A successful launch fills a manifest slot whether the locality was
      // created now or on an earlier run — reruns must not walk into reserves.
      created += 1;
      rows.push({
        ...base,
        canonical: ensured.name,
        providerId: match.providerId,
        created: ensured.created,
        cityId: ensured.cityId,
        citySlug: ensured.citySlug,
        groupId: ensured.groupId,
        groupSlug: ensured.groupSlug,
        queueStatus: "launched",
        note: ensured.created ? "created" : "already existed",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Launch failed";
      await supabaseAdmin
        .from("city_launch_queue")
        .update({ status: "failed", error: message })
        .eq("id", queued.id);
      rows.push({
        ...base,
        canonical: match.name,
        providerId: match.providerId,
        queueStatus: "failed",
        note: message,
      });
    }
  }

  console.log(JSON.stringify({ created, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
