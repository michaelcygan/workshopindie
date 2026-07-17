/**
 * Shared RSS/Atom parser used by the public group-news endpoint.
 * Pure functions — safe to import from either browser or server.
 */

export type NewsItem = {
  title: string;
  link: string;
  published_at: string | null;
};

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function parseFeed(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];

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

  return items;
}
