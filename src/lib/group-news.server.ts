/**
 * Server-only helpers shared by the group news endpoints.
 *
 * All the production reliability work lives here: publishable-key client with
 * the `sb_` apikey shim, cache-first reads from `group_news_cache`, upstream
 * retries with a timeout, and stale-cache fallback.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseFeed, type NewsItem } from "@/lib/group-news";

export type FetchReason =
  | "ok"
  | "empty_feed"
  | "upstream_status"
  | "upstream_timeout"
  | "upstream_error";

/** How long a cached snapshot is considered fresh enough to serve as-is. */
export const CACHE_FRESH_MS = 20 * 60 * 1000;

export function publicSupabase(url: string, key: string): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
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
}

export type CacheEntry = { items: NewsItem[]; ageMs: number };

/** Reads cached snapshots for one or more slugs in a single query. */
export async function readNewsCache(
  supabase: SupabaseClient<Database>,
  slugs: string[],
): Promise<Map<string, CacheEntry>> {
  const out = new Map<string, CacheEntry>();
  if (slugs.length === 0) return out;
  const { data } = await supabase
    .from("group_news_cache" as never)
    .select("slug, items, fetched_at")
    .in("slug", slugs);
  for (const row of (data ?? []) as unknown as Array<{
    slug: string;
    items?: NewsItem[] | null;
    fetched_at?: string | null;
  }>) {
    out.set(row.slug, {
      items: Array.isArray(row.items) ? row.items : [],
      ageMs: row.fetched_at
        ? Date.now() - new Date(row.fetched_at).getTime()
        : Number.POSITIVE_INFINITY,
    });
  }
  return out;
}

/** Fetches and parses an RSS/Atom feed with retries. Never throws. */
export async function fetchFeedItems(
  feedUrl: string,
  slug: string,
  limit = 12,
): Promise<{ items: NewsItem[]; reason: FetchReason }> {
  let hostname = "unknown";
  try {
    hostname = new URL(feedUrl).hostname;
  } catch {
    return { items: [], reason: "upstream_error" };
  }

  let xml = "";
  let failure: FetchReason | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(feedUrl, {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5",
          "accept-language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        failure = "upstream_status";
        console.error(
          `[group-news] upstream ${res.status} slug=${slug} hostname=${hostname} attempt=${attempt + 1}`,
        );
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      xml = await res.text();
      failure = null;
      break;
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      failure = timedOut ? "upstream_timeout" : "upstream_error";
      console.error(
        `[group-news] upstream ${timedOut ? "timeout" : "error"} slug=${slug} hostname=${hostname} name=${
          e instanceof Error ? e.name : "unknown"
        }`,
      );
    }
  }

  if (failure) return { items: [], reason: failure };

  const items = parseFeed(xml, limit);
  if (items.length === 0) {
    console.warn(
      `[group-news] parse returned zero items slug=${slug} hostname=${hostname} bytes=${xml.length}`,
    );
    return { items: [], reason: "empty_feed" };
  }
  return { items, reason: "ok" };
}

/** Best-effort cache write; failures are logged, never thrown. */
export async function writeNewsCache(slug: string, items: NewsItem[]): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("group_news_cache" as never)
      .upsert({ slug, items, fetched_at: new Date().toISOString() } as never, {
        onConflict: "slug",
      });
  } catch (e) {
    console.error(
      `[group-news] cache write failed slug=${slug} name=${e instanceof Error ? e.name : "?"}`,
    );
  }
}
