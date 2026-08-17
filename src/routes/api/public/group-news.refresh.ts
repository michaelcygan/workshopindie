import { createFileRoute } from "@tanstack/react-router";
import {
  CACHE_FRESH_MS,
  publicSupabase,
  readNewsCache,
  refreshFeed,
} from "@/lib/group-news.server";

/**
 * Scheduled warmer for the group news cache.
 *
 * Called by pg_cron. Refreshes every group feed whose cached snapshot is
 * older than the freshness window, awaiting the work so the writes actually
 * land (background tasks are killed when the response returns).
 */

const MAX_PER_RUN = 24;
const CONCURRENCY = 4;

export const Route = createFileRoute("/api/public/group-news/refresh")({
  server: {
    handlers: {
      POST: async () => run(),
      GET: async () => run(),
    },
  },
});

async function run(): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[group-news-refresh] config missing");
    return Response.json({ ok: false, reason: "config" }, { status: 500 });
  }

  const supabase = publicSupabase(url, key);
  const { data, error } = await supabase
    .from("groups")
    .select("slug,news_feed_url")
    .not("news_feed_url", "is", null);

  if (error) {
    console.error(`[group-news-refresh] db error code=${error.code ?? "?"}`);
    return Response.json({ ok: false, reason: "db_error" }, { status: 500 });
  }

  const feeds = ((data ?? []) as unknown as Array<{ slug: string; news_feed_url: string | null }>)
    .filter((g) => !!g.news_feed_url)
    .slice(0, MAX_PER_RUN);

  const cache = await readNewsCache(
    supabase,
    feeds.map((g) => g.slug),
  );
  const stale = feeds.filter((g) => {
    const entry = cache.get(g.slug);
    return !entry || entry.items.length === 0 || entry.ageMs >= CACHE_FRESH_MS;
  });

  const outcomes: Record<string, number> = {};
  const queue = [...stale];
  const worker = async () => {
    for (;;) {
      const g = queue.shift();
      if (!g) return;
      try {
        const { reason } = await refreshFeed(g.slug, g.news_feed_url!, 12);
        outcomes[reason] = (outcomes[reason] ?? 0) + 1;
      } catch {
        outcomes["upstream_error"] = (outcomes["upstream_error"] ?? 0) + 1;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  console.log(
    `[group-news-refresh] feeds=${feeds.length} stale=${stale.length} outcomes=${JSON.stringify(outcomes)}`,
  );
  return Response.json(
    { ok: true, feeds: feeds.length, refreshed: stale.length, outcomes },
    { headers: { "Cache-Control": "no-store" } },
  );
}
