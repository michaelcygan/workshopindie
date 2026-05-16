import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const venueSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  osm_ref: z.string().max(64).nullable(),
  city: z.object({
    name: z.string().min(1).max(120),
    state_region: z.string().max(120).nullable(),
    country: z.string().min(1).max(120),
    country_code: z.string().min(2).max(3).nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  }),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const resolveVenueAndCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => venueSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cc = (data.city.country_code ?? "").toLowerCase();
    const baseSlug = slugify(data.city.name) || "city";
    const slug = cc ? `${baseSlug}-${cc}` : baseSlug;

    // Try to find existing by slug
    const { data: existing } = await supabase
      .from("cities")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    let cityId = existing?.id ?? null;

    if (!cityId) {
      const { data: inserted, error: insertErr } = await supabase
        .from("cities")
        .insert({
          name: data.city.name,
          state_region: data.city.state_region,
          country: data.city.country,
          slug,
          latitude: data.city.lat,
          longitude: data.city.lng,
        })
        .select("id")
        .single();
      if (insertErr) {
        // Race: someone else inserted same slug; re-select
        const { data: retry } = await supabase
          .from("cities")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (!retry) throw new Error(insertErr.message);
        cityId = retry.id;
      } else {
        cityId = inserted.id;
      }
    }

    return {
      city_id: cityId,
      venue_name: data.name,
      venue_address: data.address,
      venue_lat: data.lat,
      venue_lng: data.lng,
      venue_osm_ref: data.osm_ref,
    };
  });
