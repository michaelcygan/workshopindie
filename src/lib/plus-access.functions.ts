/**
 * Client-facing server functions for effective Plus access.
 *
 * `getMyEffectivePlusAccess` returns the same `EffectivePlusAccess` shape the
 * server uses to gate features, so client UI never has to reconstruct it.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EffectivePlusAccess } from "./plus-access";
import { FREE_EFFECTIVE_PLUS_ACCESS } from "./plus-access";

export const getMyEffectivePlusAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EffectivePlusAccess> => {
    const { resolveEffectivePlusAccess } = await import("./plus-access.server");
    try {
      return await resolveEffectivePlusAccess(context.userId);
    } catch (e) {
      console.error("[plus-access] resolve failed", e);
      return FREE_EFFECTIVE_PLUS_ACCESS;
    }
  });
