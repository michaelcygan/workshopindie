import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SITE = "https://workshopindie.com";

function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

export const Route = createFileRoute("/blog/rss.xml")({
  server: {
    handlers: {
      GET: async () => {
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const { data: posts } = await sb
          .from("blog_posts")
          .select("title,slug,excerpt,author_name,published_at,cover_image_url")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(50);

        const items = (posts ?? []).map((p) => {
          const url = `${SITE}/blog/${p.slug}`;
          const pubDate = p.published_at ? new Date(p.published_at).toUTCString() : new Date().toUTCString();
          return [
            "    <item>",
            `      <title>${xmlEscape(p.title)}</title>`,
            `      <link>${url}</link>`,
            `      <guid isPermaLink="true">${url}</guid>`,
            `      <pubDate>${pubDate}</pubDate>`,
            p.author_name ? `      <dc:creator><![CDATA[${p.author_name}]]></dc:creator>` : "",
            p.excerpt ? `      <description><![CDATA[${p.excerpt}]]></description>` : "",
            p.cover_image_url ? `      <enclosure url="${xmlEscape(p.cover_image_url)}" type="image/jpeg" />` : "",
            "    </item>",
          ].filter(Boolean).join("\n");
        }).join("\n");

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Workshop Blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Notes from Workshop — creative collaboration, independent art, and portfolios.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
          },
        });
      },
    },
  },
});
