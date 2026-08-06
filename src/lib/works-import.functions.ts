import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedWork } from "@/lib/url-metadata/types";

export type { Provider, BookBuyLink, ExtractedWork } from "@/lib/url-metadata/types";

const urlSchema = z.object({
  url: z.string().trim().min(1).max(2000).url(),
});

export const extractWorkFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => urlSchema.parse(input))
  .handler(async ({ data }): Promise<ExtractedWork> => {
    const { resolveUrlMetadata, cleanUrl } = await import("@/lib/url-metadata/resolve");
    const resolved = await resolveUrlMetadata(data.url);
    if (resolved) return resolved;
    const cleaned = cleanUrl(data.url);
    return {
      provider: "generic", title: null, description: null,
      cover_url: null, embed_url: null, primary_url: cleaned,
      suggested_category: null, author_name: null,
    };
  });
