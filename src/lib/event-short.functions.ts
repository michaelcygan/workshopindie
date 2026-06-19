import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const resolveEventShortCode = createServerFn({ method: "GET" })
  .inputValidator((i) => z.object({ code: z.string().min(4).max(24) }).parse(i))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: row, error } = await supabase
      .from("group_events")
      .select("slug, group:groups!inner(slug)")
      .eq("short_code", data.code.toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    type R = { slug: string; group: { slug: string } };
    const r = row as unknown as R;
    return { groupSlug: r.group.slug, eventSlug: r.slug };
  });
