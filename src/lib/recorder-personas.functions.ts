import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Recorder personas are flag-off for v1 (see audit). These server functions
 * are kept as no-op stubs so callers in `workshop-recorder.tsx` compile and
 * silently succeed. When the feature is reinstated, restore the real
 * persona table operations here.
 */

export const setPersonaMemberState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personaId: string; state: "idle" | "recording" | "ready" }) =>
    z.object({
      personaId: z.string().uuid(),
      state: z.enum(["idle", "recording", "ready"]),
    }).parse(input),
  )
  .handler(async () => ({ ok: true }));

export const mirrorPersonaTakeFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personaId: string; sourceFileId: string; takeId: string }) =>
    z.object({
      personaId: z.string().uuid(),
      sourceFileId: z.string().uuid(),
      takeId: z.string(),
    }).parse(input),
  )
  .handler(async () => ({ ok: true }));
