import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Account lifecycle facts for the signed-in user.
 *
 * Returns booleans only — the raw birthdate never leaves the server. Age
 * confirmation only needs to know *whether* a birthdate exists.
 */
export const getAccountLifecycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, birthdate, tour_completed_at, onboarded")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      profileExists: !!data,
      hasBirthdate: !!data?.birthdate,
      welcomeCompleted: !!data?.tour_completed_at,
      profileCompleted: !!data?.onboarded,
    };
  });

/**
 * Idempotent repair for the rare case where the auth trigger hasn't produced a
 * profile row yet (or it went missing). Never overwrites an existing row.
 */
export const ensureProfileRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (existing) return { created: false };
    const { error } = await supabaseAdmin.from("profiles").insert({ id: userId });
    if (error) throw new Error(error.message);
    return { created: true };
  });

/**
 * Mark the welcome introduction complete. Idempotent — the first stamp wins so
 * a duplicate call can't move the timestamp around.
 *
 * Deliberately does NOT touch `onboarded`: that still means "public profile
 * completed" and stays optional.
 */
export const completeWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: current, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("tour_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (current?.tour_completed_at) return { ok: true, alreadyCompleted: true };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tour_completed_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, alreadyCompleted: false };
  });
