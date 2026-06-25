import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Fetch and parse a group's configured news source. Supports RSS 2.0 and
 * Atom feeds (Google News alerts work — they're RSS). Returns at most
 * `limit` items, newest first. Network-cached for one hour at the CDN.
 *
 * Kept intentionally minimal — no DB writes, no auth required. The URL is
 * read from `groups.news_feed_url` (admin-configured).
 */
export const fetchGroupNews = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ group_id: z.string().uuid(), limit: z.number().int().min(1).max(20).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const limit = data.limit ?? 5;
    const { data: g, error } = await supabaseAdmin
      .from("groups")
      .select("news_feed_url")
      .eq("id", data.group_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const url = (g as { news_feed_url?: string | null } | null)?.news_feed_url ?? null;
    if (!url) return { items: [] as Array<{ title: string; link: string; published_at: string | null }> };

    let xml = "";
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "WorkshopBot/1.0 (+https://workshop.cool)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return { items: [] };
      xml = await res.text();
    } catch {
      return { items: [] };
    }

    const items: Array<{ title: string; link: string; published_at: string | null }> = [];
    const decode = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/<[^>]+>/g, "")
        .trim();

    // RSS 2.0 <item>
    const rssRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = rssRe.exec(xml)) && items.length < limit) {
      const block = m[1];
      const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? "");
      const link = decode(/<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1] ?? "");
      const date = decode(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(block)?.[1] ?? "");
      if (title && link) items.push({ title, link, published_at: date || null });
    }
    // Atom <entry>
    if (items.length === 0) {
      const atomRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
      while ((m = atomRe.exec(xml)) && items.length < limit) {
        const block = m[1];
        const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? "");
        const linkAttr = /<link\b[^>]*href=["']([^"']+)["']/i.exec(block)?.[1] ?? "";
        const date = decode(
          /<updated[^>]*>([\s\S]*?)<\/updated>/i.exec(block)?.[1] ??
            /<published[^>]*>([\s\S]*?)<\/published>/i.exec(block)?.[1] ??
            "",
        );
        if (title && linkAttr) items.push({ title, link: linkAttr, published_at: date || null });
      }
    }
    return { items };
  });
