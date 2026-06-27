import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Category } from "@/lib/categories";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlSchema = z.object({
  url: z.string().trim().min(1).max(2000).url(),
});

export type Provider =
  | "youtube"
  | "vimeo"
  | "soundcloud"
  | "spotify"
  | "bandcamp"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "github"
  | "behance"
  | "dribbble"
  | "arena"
  | "substack"
  | "medium"
  | "amazon"
  | "goodreads"
  | "bookshop"
  | "apple_books"
  | "google_books"
  | "generic";

export type BookBuyLink = { label: string; url: string };

export type ExtractedWork = {
  provider: Provider;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  embed_url: string | null;
  primary_url: string;
  suggested_category: Category | null;
  author_name: string | null;
  /** Populated only when the link is recognized as a book source. */
  book?: {
    author: string | null;
    buy_links: BookBuyLink[];
  };
};


const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "mc_cid", "mc_eid", "si", "feature",
];

function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return raw;
  }
}

function detectProvider(u: URL): Provider {
  const h = u.hostname.replace(/^www\./, "");
  if (h.endsWith("youtube.com") || h === "youtu.be" || h.endsWith("youtube-nocookie.com")) return "youtube";
  if (h.endsWith("vimeo.com")) return "vimeo";
  if (h.endsWith("soundcloud.com")) return "soundcloud";
  if (h.endsWith("spotify.com")) return "spotify";
  if (h.endsWith("bandcamp.com")) return "bandcamp";
  if (h.endsWith("tiktok.com")) return "tiktok";
  if (h.endsWith("instagram.com")) return "instagram";
  if (h === "twitter.com" || h === "x.com") return "twitter";
  if (h.endsWith("github.com")) return "github";
  if (h.endsWith("behance.net")) return "behance";
  if (h.endsWith("dribbble.com")) return "dribbble";
  if (h.endsWith("are.na")) return "arena";
  if (h.endsWith("substack.com")) return "substack";
  if (h.endsWith("medium.com")) return "medium";
  // Books
  if (h === "amazon.com" || h.endsWith(".amazon.com") || /(^|\.)amazon\.[a-z.]+$/.test(h) || h === "a.co") return "amazon";
  if (h.endsWith("goodreads.com")) return "goodreads";
  if (h.endsWith("bookshop.org")) return "bookshop";
  if (h === "books.apple.com") return "apple_books";
  if (h === "books.google.com" || h === "play.google.com") return "google_books";
  return "generic";
}

function categoryFor(p: Provider): Category | null {
  switch (p) {
    case "youtube": case "vimeo": case "tiktok": return "film";
    case "soundcloud": case "spotify": case "bandcamp": return "music";
    case "github": return "build";
    case "behance": case "dribbble": case "instagram": case "arena": return "visual";
    case "substack": case "medium": return "writing";
    case "amazon": case "goodreads": case "bookshop": case "apple_books": case "google_books":
      return "writing_book";
    default: return null;
  }
}

const BOOK_PROVIDER_LABELS: Partial<Record<Provider, string>> = {
  amazon: "Amazon",
  goodreads: "Goodreads",
  bookshop: "Bookshop",
  apple_books: "Apple Books",
  google_books: "Google Books",
};

function isBookProvider(p: Provider): boolean {
  return p in BOOK_PROVIDER_LABELS;
}

function pickJsonLdAuthor(html: string): string | null {
  // Find JSON-LD blocks and look for a Book entity's author.name
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!blocks) return null;
  for (const block of blocks) {
    const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(inner);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const types = ([] as string[]).concat(item?.["@type"] ?? []);
        if (types.some((t) => /book/i.test(t))) {
          const a = item.author;
          if (typeof a === "string" && a.trim()) return a.trim();
          if (Array.isArray(a) && a[0]) {
            return typeof a[0] === "string" ? a[0] : (a[0]?.name ?? null);
          }
          if (a?.name) return String(a.name);
        }
      }
    } catch { /* skip malformed */ }
  }
  return null;
}


function youtubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
  if (u.pathname.startsWith("/watch")) return u.searchParams.get("v");
  const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/]+)/);
  return m?.[2] ?? null;
}

function vimeoId(u: URL): string | null {
  const m = u.pathname.match(/\/(\d+)/);
  return m?.[1] ?? null;
}

function buildEmbedUrl(p: Provider, u: URL, oembedHtml?: string | null): string | null {
  if (p === "youtube") {
    const id = youtubeId(u);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (p === "vimeo") {
    const id = vimeoId(u);
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (p === "spotify") {
    // open.spotify.com/track/ID -> open.spotify.com/embed/track/ID
    const m = u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/([^/]+)/);
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  }
  if (p === "soundcloud") {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
  }
  if (p === "bandcamp" && oembedHtml) {
    const m = oembedHtml.match(/src="([^"]+EmbeddedPlayer[^"]+)"/);
    return m?.[1] ?? null;
  }
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "User-Agent": "WorkshopBot/1.0 (+https://workshopindie.com)",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const OEMBED_ENDPOINTS: Partial<Record<Provider, (u: string) => string | null>> = {
  youtube: (u) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  vimeo: (u) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u)}`,
  soundcloud: (u) => `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  spotify: (u) => `https://open.spotify.com/oembed?url=${encodeURIComponent(u)}`,
  bandcamp: (u) => `https://bandcamp.com/oembed?format=json&url=${encodeURIComponent(u)}`,
  tiktok: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
};

type OEmbed = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  description?: string;
  html?: string;
};

async function tryOEmbed(provider: Provider, url: string): Promise<OEmbed | null> {
  const ep = OEMBED_ENDPOINTS[provider]?.(url);
  if (!ep) return null;
  const res = await fetchWithTimeout(ep, { headers: { Accept: "application/json" } }, 3500);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function pickMeta(html: string, prop: string): string | null {
  // property="og:title" or name="twitter:title"
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
  // content first, then property
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i",
  );
  const m2 = html.match(re2);
  return m2 ? decodeEntities(m2[1]) : null;
}

function pickTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : null;
}

async function scrapeOpenGraph(url: string) {
  const res = await fetchWithTimeout(url, { headers: { Accept: "text/html,*/*" } }, 4000);
  if (!res || !res.ok) return null;
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html")) return null;
  // cap to 256KB to avoid huge bodies
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return text.slice(0, 262_144);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 262_144) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder("utf-8").decode(buf);
}

export const extractWorkFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => urlSchema.parse(input))
  .handler(async ({ data }): Promise<ExtractedWork> => {
    const cleaned = cleanUrl(data.url);
    let u: URL;
    try { u = new URL(cleaned); } catch {
      return {
        provider: "generic", title: null, description: null,
        cover_url: null, embed_url: null, primary_url: cleaned,
        suggested_category: null, author_name: null,
      };
    }

    const provider = detectProvider(u);
    const base: ExtractedWork = {
      provider,
      title: u.hostname.replace(/^www\./, ""),
      description: null,
      cover_url: null,
      embed_url: null,
      primary_url: cleaned,
      suggested_category: categoryFor(provider),
      author_name: null,
    };

    // 1) oEmbed
    const oembed = await tryOEmbed(provider, cleaned);
    if (oembed) {
      base.title = oembed.title ?? base.title;
      base.author_name = oembed.author_name ?? null;
      base.cover_url = oembed.thumbnail_url ?? null;
      base.description = oembed.description ?? null;
      base.embed_url = buildEmbedUrl(provider, u, oembed.html ?? null);
    }

    // 2) OG fallback / enrichment — also retained for book metadata below
    let html: string | null = null;
    if (!oembed || !base.cover_url || !base.description || isBookProvider(provider)) {
      html = await scrapeOpenGraph(cleaned);
      if (html) {
        const ogTitle = pickMeta(html, "og:title") ?? pickMeta(html, "twitter:title") ?? pickTitle(html);
        const ogDesc = pickMeta(html, "og:description") ?? pickMeta(html, "twitter:description") ?? pickMeta(html, "description");
        const ogImg = pickMeta(html, "og:image") ?? pickMeta(html, "twitter:image") ?? pickMeta(html, "og:image:url");
        if (ogTitle && (!oembed || !oembed.title)) base.title = ogTitle;
        if (ogDesc && !base.description) base.description = ogDesc;
        if (ogImg && !base.cover_url) {
          try { base.cover_url = new URL(ogImg, cleaned).toString(); } catch { /* ignore */ }
        }
      }
    }

    // 3) Build provider embed even when oEmbed didn't run
    if (!base.embed_url) base.embed_url = buildEmbedUrl(provider, u);

    // 4) Upgrade YouTube thumbnails to maxresdefault (no letterboxing).
    if (provider === "youtube") {
      const id = youtubeId(u);
      if (id) {
        const maxres = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
        const head = await fetchWithTimeout(maxres, { method: "HEAD" }, 2000);
        if (head && head.ok) {
          base.cover_url = maxres;
        } else {
          base.cover_url = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
        }
      }
    }

    // 4b) GitHub — enrich via the public REST API (no auth needed, 60 req/hr
    // per IP is plenty for one-off "Post a Work" calls). Use the OpenGraph
    // social card endpoint for a clean 1280x640 cover with the repo name.
    if (provider === "github") {
      const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
      if (seg.length >= 2) {
        const owner = seg[0];
        const repo = seg[1].replace(/\.git$/, "");
        const res = await fetchWithTimeout(
          `https://api.github.com/repos/${owner}/${repo}`,
          { headers: { Accept: "application/vnd.github+json" } },
          3500,
        );
        if (res && res.ok) {
          try {
            const j = await res.json() as {
              name?: string; full_name?: string; description?: string | null;
              stargazers_count?: number; language?: string | null; homepage?: string | null;
            };
            base.title = j.name ?? j.full_name ?? base.title;
            if (j.description) base.description = j.description;
            const bits: string[] = [];
            if (typeof j.stargazers_count === "number") bits.push(`★ ${j.stargazers_count}`);
            if (j.language) bits.push(j.language);
            if (bits.length && base.description && !base.description.includes("★")) {
              base.description = `${bits.join(" · ")}\n\n${base.description}`;
            }
          } catch { /* ignore */ }
        }
        // Always set a deterministic, well-cropped cover.
        base.cover_url = `https://opengraph.githubassets.com/1/${owner}/${repo}`;
        base.embed_url = null;
      }
    }



    // 5) Books — pull author + seed a buy link from the source URL.
    if (isBookProvider(provider)) {
      let author: string | null = null;
      if (html) {
        author = pickJsonLdAuthor(html)
          ?? pickMeta(html, "books:author")
          ?? pickMeta(html, "book:author")
          ?? null;
      }
      // Goodreads OG title is "Title by Author" — split it if author still missing.
      if (!author && provider === "goodreads" && base.title?.includes(" by ")) {
        const parts = base.title.split(" by ");
        base.title = parts[0].trim();
        author = parts.slice(1).join(" by ").trim();
      }
      // Amazon often strips "Amazon.com: " prefix on og:title; tidy it up.
      if (provider === "amazon" && base.title) {
        base.title = base.title.replace(/^Amazon\.[a-z.]+:\s*/i, "").trim();
      }
      const buyLabel = BOOK_PROVIDER_LABELS[provider] ?? "Buy";
      base.book = {
        author: author ?? base.author_name,
        buy_links: [{ label: buyLabel, url: cleaned }],
      };
      // Books don't embed.
      base.embed_url = null;
    }

    return base;
  });

