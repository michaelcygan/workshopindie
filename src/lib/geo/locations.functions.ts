import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type LocationOption = {
  /** Present when Workshop already has this locality. */
  cityId: string | null;
  /** Provider identity, present for results that may still need provisioning. */
  providerId: string | null;
  name: string;
  sublabel: string;
  slug: string | null;
  existing: boolean;
};

export type EnsuredLocation = {
  cityId: string;
  citySlug: string;
  groupId: string;
  groupSlug: string;
  name: string;
  created: boolean;
};

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/**
 * Worldwide locality search. Read-only and callable anonymously — searching
 * NEVER provisions a locality (Wave 6).
 */
export const searchLocations = createServerFn({ method: "GET" })
  .inputValidator((input: { q?: string }) =>
    z.object({ q: z.string().max(120).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<{ options: LocationOption[] }> => {
    const q = (data.q ?? "").trim();
    const supabase = publicClient();

    const { data: rows } = await supabase.rpc("search_cities", { _q: q, _limit: 8 });

    const existing: LocationOption[] = (rows ?? []).map((r) => ({
      cityId: r.id,
      providerId: null,
      name: r.name,
      sublabel: [r.state_region, r.country].filter(Boolean).join(", "),
      slug: r.slug,
      existing: true,
    }));

    if (q.length < 2) return { options: existing };

    const { searchProviderLocalities } = await import("@/lib/geo/provider.server");
    const remote = await searchProviderLocalities(q, { limit: 8 });

    const seen = new Set(
      existing.map((o) => `${o.name.toLowerCase()}|${o.sublabel.toLowerCase()}`),
    );
    const fresh: LocationOption[] = [];
    for (const p of remote) {
      const key = `${p.name.toLowerCase()}|${p.sublabel.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fresh.push({
        cityId: null,
        providerId: p.providerId,
        name: p.name,
        sublabel: p.sublabel,
        slug: null,
        existing: false,
      });
    }

    return { options: [...existing, ...fresh].slice(0, 12) };
  });

/**
 * THE canonical way a locality enters Workshop.
 *
 * The client sends only a provider identity — never place metadata. The place
 * is re-resolved and validated server-side, then a single atomic RPC creates
 * (or returns) the city and its one official city Group.
 */
export const ensureLocationAndOfficialGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { providerId: string; join?: boolean }) =>
    z
      .object({
        providerId: z.string().regex(/^[NWR]\d{1,20}$/, "Unrecognized place"),
        join: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EnsuredLocation> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveProviderPlace, PLACE_PROVIDER } = await import("@/lib/geo/provider.server");
    const { slugCandidates } = await import("@/lib/geo/slug-candidates");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    // Selecting a locality Workshop already has is not "provisioning" and is
    // never rate limited.
    const { data: known } = await supabaseAdmin
      .from("cities")
      .select("id")
      .eq("place_provider", PLACE_PROVIDER)
      .eq("place_provider_id", data.providerId)
      .maybeSingle();

    if (!known && !isAdmin) {
      const { data: ok } = await supabaseAdmin.rpc("check_and_bump", {
        _action: "provision_locality",
        _key: userId,
        _window_s: 86400,
        _max: 5,
      });
      if (ok === false) {
        throw new Error("You've added several new places recently. Try again tomorrow.");
      }
    }

    const place = await resolveProviderPlace(data.providerId);
    if (!place) {
      throw new Error("That place couldn't be verified as a city or town.");
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

    if (data.join !== false) {
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
  });
