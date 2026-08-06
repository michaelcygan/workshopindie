import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Venue selection sends only what describes the venue itself. The Workshop
 * city is derived server-side from the venue's coordinates and provisioned
 * through the one safe geography path — browser-supplied city metadata is
 * never trusted or stored.
 */
const venueSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osm_ref: z.string().max(64).nullable(),
});

export const resolveVenueAndCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => venueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { reverseProviderLocality } = await import("@/lib/geo/provider.server");
    const { ensureLocalityFromPlace } = await import("@/lib/geo/provision.server");

    const base = {
      venue_name: data.name,
      venue_address: data.address,
      venue_lat: data.lat,
      venue_lng: data.lng,
      venue_osm_ref: data.osm_ref,
    };

    const place = await reverseProviderLocality(data.lat, data.lng);
    if (!place) return { ...base, city_id: null, city_label: null, city_created: false };

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    try {
      const ensured = await ensureLocalityFromPlace({
        place,
        userId,
        isAdmin: !!isAdmin,
        // Posting an event somewhere shouldn't silently join you to that scene.
        join: false,
      });
      return {
        ...base,
        city_id: ensured.cityId,
        city_label: place.sublabel ? `${place.name}, ${place.sublabel}` : place.name,
        city_created: ensured.created,
      };
    } catch {
      // Never block the event form on geography.
      return { ...base, city_id: null, city_label: null, city_created: false };
    }
  });
