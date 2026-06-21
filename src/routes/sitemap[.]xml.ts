import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SITE = "https://workshopindie.com";

const STATIC_PATHS = [
  "", "gallery", "workshops", "collab", "cities", "groups", "g",
  "pricing", "refer", "onboarding", "login", "signup", "forgot-password", "reset-password",
];


function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}


export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Use a request-scoped publishable-key client + anon SELECT policies — no service role
        // at the crawler boundary, and PostgREST can cache repeated reads.
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const urls: { loc: string; lastmod?: string; priority?: number }[] = [];
        for (const p of STATIC_PATHS) {
          urls.push({ loc: `${SITE}/${p}`, priority: p === "" ? 1.0 : 0.7 });
        }

        const [works, profiles, workshops, collabs, cities] = await Promise.all([
          sb.from("works").select("slug,published_at").eq("status", "published").in("visibility", ["public", "unlisted"]).order("published_at", { ascending: false }).limit(45000),
          sb.from("profiles").select("username,updated_at").not("username", "is", null).limit(45000),
          sb.from("workshops").select("slug,updated_at").in("status", ["open", "check_in", "active", "finalizing", "shipped"]).limit(10000),
          sb.from("collab_posts").select("slug,updated_at").eq("status", "open").limit(10000),
          sb.from("cities").select("slug").limit(2000),
        ]);


        for (const w of works.data ?? []) urls.push({ loc: `${SITE}/works/${w.slug}`, lastmod: w.published_at ?? undefined, priority: 0.8 });
        for (const p of profiles.data ?? []) urls.push({ loc: `${SITE}/u/${p.username}`, lastmod: p.updated_at ?? undefined, priority: 0.6 });
        for (const w of workshops.data ?? []) urls.push({ loc: `${SITE}/workshops/${w.slug}`, lastmod: w.updated_at ?? undefined, priority: 0.7 });
        for (const c of collabs.data ?? []) urls.push({ loc: `${SITE}/collab/${c.slug}`, lastmod: c.updated_at ?? undefined, priority: 0.7 });
        for (const c of cities.data ?? []) urls.push({ loc: `${SITE}/cities/${c.slug}`, priority: 0.5 });

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.priority != null ? `<priority>${u.priority.toFixed(1)}</priority>` : ""}</url>`).join("\n")}
</urlset>`;

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          },
        });
      },
    },
  },
});
