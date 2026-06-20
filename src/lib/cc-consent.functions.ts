import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Read the signed-in user's Creative Commons consent state.
 * `ack=true` means they've dismissed the Workshop CC notice and don't want
 * to see it again (perma-consent).
 */
export const getMyCcConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("cc_consent_ack, cc_consent_ack_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      ack: (data as { cc_consent_ack?: boolean } | null)?.cc_consent_ack ?? false,
      ackAt:
        (data as { cc_consent_ack_at?: string | null } | null)?.cc_consent_ack_at ?? null,
    };
  });

/** Set or clear perma-consent for the Workshop CC notice. */
export const setMyCcConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ack: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        cc_consent_ack: data.ack,
        cc_consent_ack_at: data.ack ? new Date().toISOString() : null,
      } as never)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
