import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addInfluenceSchema,
  removeInfluenceSchema,
  reorderInfluencesSchema,
  resolveInfluenceUrlSchema,
  updateInfluenceSchema,
} from "@/lib/influences/schemas";
import type { ResolvedInfluenceMeta } from "@/lib/influences/schemas";

/**
 * Resolve metadata for an external influence URL.
 * Throws a user-facing message when the URL fails the safety gate.
 */
export const resolveInfluenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => resolveInfluenceUrlSchema.parse(input))
  .handler(async ({ data, context }): Promise<ResolvedInfluenceMeta> => {
    const { prepareExternalInfluence } = await import("@/lib/influences/influences.server");
    return prepareExternalInfluence(data.url, context.userId, { resolve: true });
  });

export const addInfluence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addInfluenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { insertInfluence } = await import("@/lib/influences/influences.server");
    return insertInfluence(context.supabase, context.userId, data);
  });

export const updateInfluence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateInfluenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { patchInfluence } = await import("@/lib/influences/influences.server");
    return patchInfluence(context.supabase, context.userId, data);
  });

export const removeInfluence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => removeInfluenceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { deleteInfluence } = await import("@/lib/influences/influences.server");
    return deleteInfluence(context.supabase, context.userId, data.id);
  });

export const reorderInfluences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderInfluencesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { applyInfluenceOrder } = await import("@/lib/influences/influences.server");
    return applyInfluenceOrder(context.supabase, context.userId, data.ids);
  });
