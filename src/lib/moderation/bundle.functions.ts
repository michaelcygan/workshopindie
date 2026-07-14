import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LexiconTerm } from "./engine";

/**
 * Public server fn: returns the compiled-shape lexicon snapshot for the
 * browser to run pre-check UX against. This is NOT authoritative — the
 * server re-runs the same engine on every write. Client bundle contains
 * only enabled patterns; the raw list is otherwise admin-only.
 */
export const getModerationClientBundle = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  // moderation_terms is admin-only; use a SECURITY DEFINER view? Simpler: expose
  // only via a server call using service role. To avoid hand-rolling admin here,
  // read version publicly and pull terms via publishable + a permissive policy…
  // Instead, we defer to the server admin client via a lightweight lambda:
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: v }, { data: rows }] = await Promise.all([
    supabase.from("moderation_lexicon_version").select("version").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("moderation_terms").select("id, term, kind, severity, category").eq("enabled", true),
  ]);
  const version = Number(v?.version ?? 0);
  const terms = (rows ?? []) as LexiconTerm[];
  return { version, terms };
});
