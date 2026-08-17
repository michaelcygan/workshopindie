import { createFileRoute } from "@tanstack/react-router";
import type { NewsItem } from "@/lib/group-news";
import {
  CACHE_FRESH_MS,
  REFRESH_BUDGET_MS,
  publicSupabase,
  readNewsCache,
  refreshFeed,
  withBudget,
} from "@/lib/group-news.server";

/**
 * Aggregated news across several groups — used by the logged-in homepage
 * ticker. Cache-first: one query for the groups, one for their cached
 * snapshots, and at most a couple of upstream refreshes per request so a slow
 * RSS host can never hold up the homepage.
 */

type AggregateItem = NewsItem & { groupName: string; groupSlug: string };

const MAX_SLUGS = 12;
const MAX_ITEMS = 18;
const MAX_REFRESH = 2;

const SHORT = "public, max-age=300, s-maxage=300";
const NO_STORE = "no-store";
const SUCCESS = "public, max-age=900, s-maxage=900, stale-while-revalidate=86400";

function json(items: AggregateItem[], reason: string, status: number, cache: string): Response {
  return Response.json({ items, reason }, { status, headers: { "Cache-Control": cache } });
}

export const Route = createFileRoute("/api/public/group-news-multi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("slugs") ?? "";
        const slugs = Array.from(
          new Set(
            raw
              .split(",")
              .map((s) => s.trim())
              .filter((s) => /^[a-z0-9-]{1,80}$/i.test(s)),
          ),
        ).slice(0, MAX_SLUGS);

        if (slugs.length === 0) return json([], "no_slugs", 200, SHORT);

        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) {
          console.error("[group-news-multi] config missing");
          return json([], "config", 500, NO_STORE);
        }

        const supabase = publicSupabase(url, key);

        const { data: groups, error } = await supabase
          .from("groups")
          .select("slug,name,news_feed_url")
          .in("slug", slugs);
        if (error) {
          console.error(`[group-news-multi] db error code=${error.code ?? "?"}`);
          return json([], "db_error", 500, NO_STORE);
        }

        const feeds = ((groups ?? []) as unknown as Array<{
          slug: string;
          name: string;
          news_feed_url: string | null;
        }>).filter((g) => !!g.news_feed_url);
        if (feeds.length === 0) return json([], "no_feed", 200, SHORT);

        const cache = await readNewsCache(
          supabase,
          feeds.map((g) => g.slug),
        );

        // Refresh the stalest handful within a bounded wall-clock budget.
        // Background work is killed once the response returns, so anything we
        // do not await here would never write to the cache.
        const stale = feeds.filter((g) => {
          const entry = cache.get(g.slug);
          return !entry || entry.items.length === 0 || entry.ageMs >= CACHE_FRESH_MS;
        });

        const refresh = async (g: { slug: string; news_feed_url: string | null }) => {
          const { items, reason } = await refreshFeed(g.slug, g.news_feed_url!, 8);
          if (reason === "ok") cache.set(g.slug, { items, ageMs: 0 });
        };

        if (stale.length > 0) {
          await withBudget(
            Promise.all(stale.slice(0, MAX_REFRESH).map((g) => refresh(g).catch(() => {}))),
            REFRESH_BUDGET_MS,
          );
        }

        const merged: AggregateItem[] = [];
        const seen = new Set<string>();
        for (const g of feeds) {
          for (const item of (cache.get(g.slug)?.items ?? []).slice(0, 8)) {
            if (!item?.title || !item?.link || seen.has(item.link)) continue;
            seen.add(item.link);
            merged.push({ ...item, groupName: g.name, groupSlug: g.slug });
          }
        }

        merged.sort((a, b) => {
          const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
          const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
          return tb - ta;
        });

        const items = merged.slice(0, MAX_ITEMS);
        return json(items, items.length ? "ok" : "empty_feed", 200, items.length ? SUCCESS : SHORT);
      },
    },
  },
});
