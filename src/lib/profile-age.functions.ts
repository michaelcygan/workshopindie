import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** True when a legacy birthdate on file already proves the member is 18+. */
function birthdateProvesAdult(birthdate: string | null): boolean {
  if (!birthdate) return false;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return b.getTime() <= cutoff.getTime();
}

/**
 * Read the signed-in user's own private age fields. Never exposes other users.
 *
 * Workshop no longer collects birth dates — the platform rule is a single 18+
 * attestation. A legacy birthdate that proves 18+ still satisfies it.
 */
export const getMyAgeFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("birthdate, adult_attested_at, age_filter_min, home_city_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const birthdate = (data?.birthdate as string | null) ?? null;
    const attestedAt = (data?.adult_attested_at as string | null) ?? null;
    return {
      adultConfirmed: !!attestedAt || birthdateProvesAdult(birthdate),
      attestedAt,
      ageFilterMin: (data?.age_filter_min as number | null) ?? null,
      homeCityId: (data?.home_city_id as string | null) ?? null,
    };
  });

/**
 * Record the 18+ attestation. Idempotent — the first stamp wins so repeated
 * confirmations can't move the timestamp around. Server-authoritative: the
 * client checkbox is UX, this write is the record.
 */
export const confirmAdultAttestation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ confirmed: z.literal(true) }).parse(input),
  )
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: current, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("adult_attested_at")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (current?.adult_attested_at) return { ok: true, alreadyConfirmed: true };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ adult_attested_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, alreadyConfirmed: false };
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
