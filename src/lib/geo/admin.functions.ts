/**
 * Admin geography console — server side.
 *
 * Every mutation here goes through the same primitives creators use
 * (`provision_locality` via `ensureLocalityFromPlace`) or through admin-only
 * SECURITY DEFINER functions that re-check the caller's role in the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin only");
  return true;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type AdminLocality = {
  id: string;
  name: string;
  sublabel: string;
  slug: string;
  status: string;
  needsReview: boolean;
  source: string | null;
  locationKind: string | null;
  addedBy: string | null;
  officialGroupId: string | null;
  officialGroupSlug: string | null;
  mergedIntoName: string | null;
  members: number;
  createdAt: string;
};

const listSchema = z.object({
  q: z.string().max(80).optional(),
  status: z.enum(["all", "active", "paused", "deactivated", "merged"]).optional(),
  needsReview: z.boolean().optional(),
  memberAdded: z.boolean().optional(),
  country: z.string().max(2).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const listLocalities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof listSchema>) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ localities: AdminLocality[] }> => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await adminClient();

    let query = admin
      .from("cities")
      .select(
        "id,name,state_region,country,country_code,slug,status,needs_review,provision_source,location_kind,provisioned_by,official_group_id,merged_into_city_id,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);

    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.needsReview) query = query.eq("needs_review", true);
    if (data.memberAdded) query = query.eq("provision_source", "user");
    if (data.country) query = query.eq("country_code", data.country.toUpperCase());
    if (data.q?.trim()) query = query.ilike("name", `%${data.q.trim()}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const cities = rows ?? [];
    if (cities.length === 0) return { localities: [] };

    const ids = cities.map((c) => c.id);
    const actorIds = [...new Set(cities.map((c) => c.provisioned_by).filter(Boolean))] as string[];
    const groupIds = [
      ...new Set(cities.map((c) => c.official_group_id).filter(Boolean)),
    ] as string[];
    const mergedIds = [
      ...new Set(cities.map((c) => c.merged_into_city_id).filter(Boolean)),
    ] as string[];

    const [membersRes, actorsRes, groupsRes, mergedRes] = await Promise.all([
      admin.from("profiles").select("home_city_id").in("home_city_id", ids),
      actorIds.length
        ? admin.from("profiles").select("id,username,first_name").in("id", actorIds)
        : Promise.resolve({
            data: [] as { id: string; username: string | null; first_name: string | null }[],
          }),
      groupIds.length
        ? admin.from("groups").select("id,slug").in("id", groupIds)
        : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
      mergedIds.length
        ? admin.from("cities").select("id,name").in("id", mergedIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const memberCounts = new Map<string, number>();
    for (const r of (membersRes.data ?? []) as { home_city_id: string | null }[]) {
      if (!r.home_city_id) continue;
      memberCounts.set(r.home_city_id, (memberCounts.get(r.home_city_id) ?? 0) + 1);
    }
    const actors = new Map(
      (
        (actorsRes.data ?? []) as {
          id: string;
          username: string | null;
          first_name: string | null;
        }[]
      ).map((p) => [p.id, p.username ? `@${p.username}` : (p.first_name ?? "Member")]),
    );
    const groups = new Map(
      ((groupsRes.data ?? []) as { id: string; slug: string }[]).map((g) => [g.id, g.slug]),
    );
    const merged = new Map(
      ((mergedRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    );

    return {
      localities: cities.map((c) => ({
        id: c.id,
        name: c.name,
        sublabel: [c.state_region, c.country].filter(Boolean).join(", "),
        slug: c.slug,
        status: c.status ?? "active",
        needsReview: !!c.needs_review,
        source: c.provision_source,
        locationKind: c.location_kind,
        addedBy: c.provisioned_by ? (actors.get(c.provisioned_by) ?? "Member") : null,
        officialGroupId: c.official_group_id,
        officialGroupSlug: c.official_group_id ? (groups.get(c.official_group_id) ?? null) : null,
        mergedIntoName: c.merged_into_city_id ? (merged.get(c.merged_into_city_id) ?? null) : null,
        members: memberCounts.get(c.id) ?? 0,
        createdAt: c.created_at,
      })),
    };
  });

/** Approve (clear review flag), pause, deactivate, or reactivate a locality. */
export const reviewLocality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { cityId: string; action: "approve" | "pause" | "deactivate" | "reactivate" }) =>
      z
        .object({
          cityId: z.string().uuid(),
          action: z.enum(["approve", "pause", "deactivate", "reactivate"]),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const status =
      data.action === "deactivate" ? "deactivated" : data.action === "pause" ? "paused" : "active";
    const { error } = await context.supabase.rpc("set_city_status", {
      _city: data.cityId,
      _status: status,
      _clear_review: data.action === "approve" || data.action === "reactivate",
    });
    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

/** Merge a duplicate/oversized locality into a canonical one. */
export const mergeLocality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId: string; targetId: string }) =>
    z.object({ sourceId: z.string().uuid(), targetId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: moved, error } = await context.supabase.rpc("merge_city", {
      _source: data.sourceId,
      _target: data.targetId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, moved: (moved ?? {}) as Record<string, number> };
  });

export type LaunchQueueRow = {
  id: string;
  displayName: string;
  providerId: string;
  status: string;
  error: string | null;
  cityId: string | null;
  createdAt: string;
};

export const listLaunchQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ queue: LaunchQueueRow[] }> => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const { data, error } = await admin
      .from("city_launch_queue")
      .select("id,display_name,place_provider_id,status,error,city_id,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return {
      queue: (data ?? []).map((r) => ({
        id: r.id,
        displayName: r.display_name,
        providerId: r.place_provider_id,
        status: r.status,
        error: r.error,
        cityId: r.city_id,
        createdAt: r.created_at,
      })),
    };
  });

/**
 * Shared internal: verify a provider identity server-side and upsert it into
 * the launch queue. Used by both the single-city admin launch and the one-time
 * batch launch so there is exactly one queueing implementation.
 */
async function queuePlaceForLaunch(providerId: string, userId: string) {
  const admin = await adminClient();
  const { resolveProviderPlace, PLACE_PROVIDER } = await import("@/lib/geo/provider.server");

  const place = await resolveProviderPlace(providerId);
  if (!place) throw new Error("That place couldn't be verified as a city or town.");

  const displayName = place.sublabel ? `${place.name}, ${place.sublabel}` : place.name;
  const { data: row, error } = await admin
    .from("city_launch_queue")
    .upsert(
      {
        place_provider: PLACE_PROVIDER,
        place_provider_id: place.providerId,
        display_name: displayName,
        payload: { country_code: place.countryCode, kind: place.locationKind },
        status: "queued",
        error: null,
        queued_by: userId,
      },
      { onConflict: "place_provider,place_provider_id" },
    )
    .select("id,status")
    .single();
  if (error) throw new Error(error.message);
  return { id: row.id as string, place };
}

/** Queue a place for proactive launch. The place is verified server-side. */
export const enqueueLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { providerId: string; launchNow?: boolean }) =>
    z
      .object({
        providerId: z.string().regex(/^[NWR]\d{1,20}$/, "Unrecognized place"),
        launchNow: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const queued = await queuePlaceForLaunch(data.providerId, context.userId);

    if (data.launchNow) {
      return launchQueueEntry(queued.id, context.userId);
    }
    return { ok: true, launched: false, id: queued.id };
  });


async function launchQueueEntry(queueId: string, userId: string) {
  const admin = await adminClient();
  const { resolveProviderPlace } = await import("@/lib/geo/provider.server");
  const { ensureLocalityFromPlace } = await import("@/lib/geo/provision.server");

  const { data: entry, error } = await admin
    .from("city_launch_queue")
    .select("id,place_provider_id")
    .eq("id", queueId)
    .maybeSingle();
  if (error || !entry) throw new Error("Queue entry not found");

  try {
    const place = await resolveProviderPlace(entry.place_provider_id);
    if (!place) throw new Error("Place could not be verified");
    const ensured = await ensureLocalityFromPlace({ place, userId, isAdmin: true, join: false });
    await admin
      .from("city_launch_queue")
      .update({ status: "launched", city_id: ensured.cityId, error: null })
      .eq("id", queueId);
    return {
      ok: true,
      launched: true,
      id: queueId,
      cityId: ensured.cityId,
      citySlug: ensured.citySlug,
      groupId: ensured.groupId,
      groupSlug: ensured.groupSlug,
      created: ensured.created,
      name: ensured.name,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    await admin
      .from("city_launch_queue")
      .update({ status: "failed", error: message })
      .eq("id", queueId);
    throw new Error(message);
  }
}

/** Launch (or retry) a queued place now. */
export const launchQueued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    return launchQueueEntry(data.id, context.userId);
  });

export const cancelQueued = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await adminClient();
    const { error } = await admin.from("city_launch_queue").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* One-time administrative batch launch (Midwest-first US expansion).  */
/* Orchestrates the exact same flow as the single-city admin launch.   */
/* ------------------------------------------------------------------ */

export type BatchCityResult = {
  requested: string;
  state: string;
  canonicalName: string | null;
  providerId: string | null;
  created: boolean;
  cityId: string | null;
  citySlug: string | null;
  groupId: string | null;
  groupSlug: string | null;
  queueStatus: string;
  note: string;
};

/** Nominatim asks for <=1 request/second. Keep every provider call paced. */
const PROVIDER_GAP_MS = 1100;
const CHUNK = 4;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const runCityLaunchBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cursor?: number; createdSoFar?: number }) =>
    z
      .object({
        cursor: z.number().int().min(0).max(100).optional(),
        createdSoFar: z.number().int().min(0).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { searchProviderLocalities } = await import("@/lib/geo/provider.server");
    const { LAUNCH_MANIFEST, TARGET_NEW_CITIES, matchesManifest } = await import(
      "@/lib/geo/city-launch-manifest"
    );
    const admin = await adminClient();

    let cursor = data.cursor ?? 0;
    let created = data.createdSoFar ?? 0;
    const results: BatchCityResult[] = [];
    let stopped = false;
    let stopReason: string | null = null;
    let emptySearches = 0;
    let processed = 0;

    while (
      cursor < LAUNCH_MANIFEST.length &&
      created < TARGET_NEW_CITIES &&
      processed < CHUNK &&
      !stopped
    ) {
      const entry = LAUNCH_MANIFEST[cursor]!;
      cursor += 1;
      processed += 1;

      const base: BatchCityResult = {
        requested: entry.city,
        state: entry.state,
        canonicalName: null,
        providerId: null,
        created: false,
        cityId: null,
        citySlug: null,
        groupId: null,
        groupSlug: null,
        queueStatus: "—",
        note: "",
      };

      await sleep(PROVIDER_GAP_MS);
      const candidates = await searchProviderLocalities(entry.query, { limit: 8 });
      if (candidates.length === 0) {
        emptySearches += 1;
        results.push({ ...base, note: "No provider results" });
        if (emptySearches >= 2) {
          stopped = true;
          stopReason = "Place provider returned no results twice in a row — stopping cleanly.";
        }
        continue;
      }
      emptySearches = 0;

      const match = candidates.find((p) => matchesManifest(entry, p));
      if (!match) {
        results.push({
          ...base,
          note: `No exact ${entry.city}, ${entry.state} match — skipped (reserve will be used)`,
        });
        continue;
      }

      try {
        await sleep(PROVIDER_GAP_MS);
        const queued = await queuePlaceForLaunch(match.providerId, context.userId);
        await sleep(PROVIDER_GAP_MS);
        const launched = await launchQueueEntry(queued.id, context.userId);

        // A successful launch fills the manifest slot whether the locality was
        // created now or on an earlier run — that is what makes reruns a no-op
        // instead of walking into the reserve list.
        const isNew = launched.created;
        created += 1;


        results.push({
          ...base,
          canonicalName: match.name,
          providerId: match.providerId,
          created: isNew,
          cityId: launched.cityId,
          citySlug: city?.slug ?? null,
          groupId: group?.id ?? null,
          groupSlug: group?.slug ?? null,
          queueStatus: "launched",
          note: isNew ? "Provisioned" : "Already existed",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Launch failed";
        results.push({
          ...base,
          canonicalName: match.name,
          providerId: match.providerId,
          queueStatus: "failed",
          note: message,
        });
      }
    }

    const done = stopped || cursor >= LAUNCH_MANIFEST.length || created >= TARGET_NEW_CITIES;
    return { results, cursor, created, done, stopped, stopReason };
  });
