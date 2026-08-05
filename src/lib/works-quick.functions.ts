import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createQuickWorkServer } from "@/lib/works-quick.server";
import { WORK_CATEGORY_IDS } from "@/lib/categories";

export const quickWorkSchema = z.object({
  title: z.string().trim().min(1, "Give the Work a title.").max(160),
  category: z.enum(WORK_CATEGORY_IDS),
  subtype: z.string().trim().max(80).nullable().default(null),
  primary_url: z.string().trim().url("That link doesn't look right.").nullable().default(null),
});

export const createQuickWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quickWorkSchema.parse(input))
  .handler(({ context, data }) => createQuickWorkServer(context, data));
