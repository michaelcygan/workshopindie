import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseFeed, type NewsItem } from "@/lib/group-news";

/**
 * Public JSON endpoint for a group's news feed.
 *
 * Every outcome is distinguishable via `reason` + HTTP status, and failures are
 * never CDN-cached, so a repaired backend recovers immediately instead of
 * serving a stale empty payload for half an hour.
 */
type Reason =
  | "ok"
  | "no_feed"
  | "not_found"
  | "empty_feed"
  | "config"
  | "db_error"
  | "upstream_status"
  | "upstream_timeout"
  | "upstream_error";

function json(
  items: NewsItem[],
  reason: Reason,
  status: number,
  cache: string,
): Response {
  return Response.json({ items, reason }, { status, headers: { "Cache-Control": cache } });
}

const SHORT = "public, max-age=300, s-maxage=300";
const NO_STORE = "no-store";
const SUCCESS = "public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400";

export const Route = createFileRoute("/api/public/group-news/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          console.error(`[group-news] config missing slug=${slug}`);
          return json([], "config", 500, NO_STORE);
        }

        const supabase = createClient<Database>(url, key, {
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

        const { data: g, error } = await supabase
          .from("groups")
          .select("news_feed_url")
          .eq("slug", slug)
          .maybeSingle();

        if (error) {
          console.error(`[group-news] supabase query failed slug=${slug} code=${error.code ?? "?"}`);
          return json([], "db_error", 500, NO_STORE);
        }
        if (!g) {
          console.warn(`[group-news] group not found slug=${slug}`);
          return json([], "not_found", 404, SHORT);
        }

        const feedUrl = (g as { news_feed_url?: string | null }).news_feed_url ?? null;
        if (!feedUrl) return json([], "no_feed", 200, SHORT);

        let hostname = "unknown";
        try {
          hostname = new URL(feedUrl).hostname;
        } catch {
          console.error(`[group-news] invalid feed url slug=${slug}`);
          return json([], "upstream_error", 502, NO_STORE);
        }

        let xml = "";
        try {
          const res = await fetch(feedUrl, {
            redirect: "follow",
            headers: {
              "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 WorkshopBot/1.0 (+https://workshopindie.com)",
              accept:
                "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5",
              "accept-language": "en-US,en;q=0.9",
            },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) {
            console.error(
              `[group-news] upstream ${res.status} slug=${slug} hostname=${hostname}`,
            );
            return json([], "upstream_status", 502, NO_STORE);
          }
          xml = await res.text();
        } catch (e) {
          const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
          console.error(
            `[group-news] upstream ${timedOut ? "timeout" : "error"} slug=${slug} hostname=${hostname} name=${
              e instanceof Error ? e.name : "unknown"
            } msg=${e instanceof Error ? e.message.slice(0, 120) : ""}`,
          );
          return json([], timedOut ? "upstream_timeout" : "upstream_error", 502, NO_STORE);
        }

        const items = parseFeed(xml, 12);
        if (items.length === 0) {
          console.warn(
            `[group-news] parse returned zero items slug=${slug} hostname=${hostname} bytes=${xml.length}`,
          );
          return json([], "empty_feed", 200, SHORT);
        }

        console.log(`[group-news] success slug=${slug} items=${items.length}`);
        return json(items, "ok", 200, SUCCESS);
      },
    },
  },
});
