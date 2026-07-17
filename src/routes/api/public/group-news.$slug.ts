import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseFeed, type NewsItem } from "@/lib/group-news";

/**
 * Public JSON endpoint for a group's news feed.
 *
 * Replaces the earlier `fetchGroupNews` server function whose response body
 * came back empty from the production worker. Keeping this as a plain
 * public route lets the CDN cache the JSON and keeps the client hop simple
 * (`fetch(...).then(r => r.json())`).
 */
export const Route = createFileRoute("/api/public/group-news/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(process.env.SUPABASE_URL!, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const emptyResp = (maxAge: number) =>
          Response.json(
            { items: [] as NewsItem[] },
            { headers: { "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}` } },
          );

        const { data: g, error } = await supabase
          .from("groups")
          .select("news_feed_url")
          .eq("slug", params.slug)
          .maybeSingle();

        if (error) return emptyResp(60);
        const url = (g as { news_feed_url?: string | null } | null)?.news_feed_url ?? null;
        if (!url) return emptyResp(300);

        let xml = "";
        try {
          const res = await fetch(url, {
            headers: {
              "user-agent": "WorkshopBot/1.0 (+https://workshopindie.com)",
              accept:
                "application/rss+xml, application/atom+xml, application/xml, text/xml",
            },
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) return emptyResp(120);
          xml = await res.text();
        } catch {
          return emptyResp(120);
        }

        const items = parseFeed(xml, 12);
        return Response.json(
          { items },
          {
            headers: {
              "Cache-Control":
                "public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400",
            },
          },
        );
      },
    },
  },
});
