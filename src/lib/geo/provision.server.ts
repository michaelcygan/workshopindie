/**
 * The single safe path for geography entering Workshop — server only.
 *
 * Callers may only pass a provider identity that has already been resolved
 * server-side (see provider.server.ts). Never accept place metadata from a
 * browser: everything here is re-verified before it can create a locality.
 */
import { PLACE_PROVIDER, type CanonicalPlace } from "@/lib/geo/provider.server";
import { slugCandidates } from "@/lib/geo/slug-candidates";

export type EnsuredLocation = {
  cityId: string;
  citySlug: string;
  groupId: string;
  groupSlug: string;
  name: string;
  created: boolean;
};

/** Localities a single non-admin account may bring into Workshop per day. */
const PROVISION_LIMIT_PER_DAY = 5;

export async function ensureLocalityFromPlace(opts: {
  place: CanonicalPlace;
  userId: string;
  isAdmin?: boolean;
  /** Join the official city group as a member. Defaults to true. */
  join?: boolean;
}): Promise<EnsuredLocation> {
  const { place, userId, isAdmin = false, join = true } = opts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Selecting a locality Workshop already has is not "provisioning" and is
  // never rate limited.
  const { data: known } = await supabaseAdmin
    .from("cities")
    .select("id")
    .eq("place_provider", PLACE_PROVIDER)
    .eq("place_provider_id", place.providerId)
    .maybeSingle();

  if (!known && !isAdmin) {
    const { data: ok } = await supabaseAdmin.rpc("check_and_bump", {
      _action: "provision_locality",
      _key: userId,
      _window_s: 86400,
      _max: PROVISION_LIMIT_PER_DAY,
    });
    if (ok === false) {
      throw new Error("You've added several new places recently. Try again tomorrow.");
    }
  }

  const rpcArgs = {
    _provider: place.provider,
    _provider_id: place.providerId,
    _name: place.name,
    _state_region: place.stateRegion,
    _country: place.country,
    _country_code: place.countryCode,
    _lat: place.latitude,
    _lng: place.longitude,
    _timezone: null,
    _location_kind: place.locationKind,
    _slug_candidates: slugCandidates(place),
    _user_id: userId,
    _source: isAdmin ? "admin" : "user",
    // Generated types mark these as non-nullable; the SQL accepts NULLs.
  } as unknown as Parameters<typeof supabaseAdmin.rpc<"provision_locality">>[1];

  const { data: rows, error } = await supabaseAdmin.rpc("provision_locality", rpcArgs);
  if (error) throw new Error(error.message);

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("Could not set up that location.");

  if (join) {
    await supabaseAdmin
      .from("group_members")
      .upsert(
        { group_id: row.group_id, user_id: userId, role: "member", source_type: "profile" },
        { onConflict: "group_id,user_id", ignoreDuplicates: true },
      );
  }

  if (row.was_created) {
    await supabaseAdmin.from("admin_audit_log").insert({
      actor_user_id: userId,
      action: "locality.provisioned",
      target_type: "city",
      target_id: row.city_id,
      payload: {
        provider: place.provider,
        provider_id: place.providerId,
        name: place.name,
        country_code: place.countryCode,
        source: isAdmin ? "admin" : "user",
        group_slug: row.group_slug,
      },
    });
  }

  return {
    cityId: row.city_id,
    citySlug: row.city_slug,
    groupId: row.group_id,
    groupSlug: row.group_slug,
    name: place.name,
    created: !!row.was_created,
  };
}
