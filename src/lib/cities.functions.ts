import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const citySchema = z.object({
  name: z.string().min(1).max(120),
  state_region: z.string().max(120).nullable().optional(),
  country: z.string().min(1).max(120),
  country_code: z.string().min(2).max(3).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const resolveCityFromOSM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => citySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cc = (data.country_code ?? "").toLowerCase();
    const baseSlug = slugify(data.name) || "city";
    const slug = cc ? `${baseSlug}-${cc}` : baseSlug;

    const { data: existing } = await supabase
      .from("cities")
      .select("id,name,country")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return { id: existing.id, name: existing.name, country: existing.country };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("cities")
      .insert({
        name: data.name,
        state_region: data.state_region ?? null,
        country: data.country,
        slug,
        latitude: data.lat ?? null,
        longitude: data.lng ?? null,
      })
      .select("id,name,country")
      .single();

    if (insertErr) {
      const { data: retry } = await supabase
        .from("cities")
        .select("id,name,country")
        .eq("slug", slug)
        .maybeSingle();
      if (!retry) throw new Error(insertErr.message);
      return { id: retry.id, name: retry.name, country: retry.country };
    }

    return { id: inserted.id, name: inserted.name, country: inserted.country };
  });
