import { createFileRoute } from "@tanstack/react-router";
import type { NewsItem } from "@/lib/group-news";
import {
  CACHE_FRESH_MS,
  fetchFeedItems,
  publicSupabase,
  readNewsCache,
  writeNewsCache,
} from "@/lib/group-news.server";

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

function json(items: NewsItem[], reason: Reason, status: number, cache: string): Response {
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

        const supabase = publicSupabase(url, key);

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

        // Serve a fresh cached snapshot without touching upstream at all.
        const cache = await readNewsCache(supabase, [slug]);
        const cachedItems = cache.get(slug)?.items ?? [];
        const cachedAgeMs = cache.get(slug)?.ageMs ?? Number.POSITIVE_INFINITY;
        if (cachedItems.length > 0 && cachedAgeMs < CACHE_FRESH_MS) {
          return json(cachedItems, "ok", 200, SUCCESS);
        }

        const { items, reason } = await fetchFeedItems(feedUrl, slug, 12);

        if (reason !== "ok") {
          if (cachedItems.length > 0) {
            console.warn(`[group-news] serving stale cache slug=${slug} reason=${reason}`);
            return json(cachedItems, "ok", 200, SHORT);
          }
          return json([], reason, reason === "empty_feed" ? 200 : 502, reason === "empty_feed" ? SHORT : NO_STORE);
        }

        await writeNewsCache(slug, items);

        console.log(`[group-news] success slug=${slug} items=${items.length}`);
        return json(items, "ok", 200, SUCCESS);
      },
    },
  },
});
