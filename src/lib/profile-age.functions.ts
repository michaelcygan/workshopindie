import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Read the signed-in user's own private age fields. Never exposes other users. */
export const getMyAgeFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("birthdate, age_filter_min")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      birthdate: (data?.birthdate as string | null) ?? null,
      ageFilterMin: (data?.age_filter_min as number | null) ?? null,
      locked: !!data?.birthdate,
    };
  });

/** Set the user's birthdate. Trigger enforces 13+ and one-time set. */
export const setMyBirthdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ birthdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ birthdate: data.birthdate })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Set the personal "only show me X+" workshops filter. Null = no filter. */
export const setMyAgeFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ageFilterMin: z.number().int().min(13).max(120).nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ age_filter_min: data.ageFilterMin })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
