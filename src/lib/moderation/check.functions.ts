import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Client-callable authoritative pre-check. Runs the same engine used by
 * write-path server fns and DB triggers. Does not itself store content.
 * On block: throws a ModerationError-style message the UI shows verbatim.
 */
export const moderateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { surface: string; fields: Record<string, string | null | undefined> }) => ({
    surface: z.string().min(1).max(120).parse(d.surface),
    fields: z.record(z.string(), z.string().nullish()).parse(d.fields),
  }))
  .handler(async ({ data, context }) => {
    const { moderateFields } = await import("@/lib/moderation/service.server");
    await moderateFields(context.userId, data.surface, data.fields);
    return { ok: true } as const;
  });
