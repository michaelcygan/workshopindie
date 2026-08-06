/**
 * Shared URL metadata resolution — used by both "Post a Work" and
 * "Add an Influence". Extracted from works-import.functions.ts so there is a
 * single hardened implementation.
 *
 * All outbound fetches go through `safeFetch`, which enforces the SSRF rules in
 * ./safety.ts on the initial URL *and* on every redirect hop.
 */
import type { Category } from "@/lib/categories";
import { checkUrlSafety, safeImageUrl } from "./safety";
import type { ExtractedWork, Provider } from "./types";

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "mc_cid", "mc_eid", "si", "feature",
];

export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return raw;
  }
}

export function detectProvider(u: URL): Provider {
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

export function categoryFor(p: Provider): Category | null {
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

/**
 * Fetch with timeout, SSRF validation, and manual redirect handling so each
 * hop is re-validated (a public URL must not be able to bounce us into a
 * private/internal destination).
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  ms = 4000,
): Promise<Response | null> {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    const check = checkUrlSafety(target);
    if (!check.ok) return null;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    let res: Response;
    try {
      res = await fetch(check.url.toString(), {
        ...init,
        redirect: "manual",
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
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      try {
        target = new URL(loc, check.url).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
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
  const res = await safeFetch(ep, { headers: { Accept: "application/json" } }, 3500);
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
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  if (m) return decodeEntities(m[1]);
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

async function scrapeOpenGraph(url: string): Promise<string | null> {
  const res = await safeFetch(url, { headers: { Accept: "text/html,*/*" } }, 4000);
  if (!res || !res.ok) return null;
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("text/html")) return null;
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

/** Clamp untrusted remote strings before they reach the database or the DOM. */
export function clampText(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const flat = String(s).replace(/\s+/g, " ").trim();
  if (!flat) return null;
  return flat.length > max ? flat.slice(0, max).trim() : flat;
}

/**
 * Resolve remote metadata for a URL. Returns `null` when the URL fails the
 * safety gate; callers translate that into a user-facing message.
 */
export async function resolveUrlMetadata(rawUrl: string): Promise<ExtractedWork | null> {
  const cleaned = cleanUrl(rawUrl);
  const check = checkUrlSafety(cleaned);
  if (!check.ok) return null;
  const u = check.url;

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
    base.cover_url = safeImageUrl(oembed.thumbnail_url ?? null);
    base.description = oembed.description ?? null;
    base.embed_url = buildEmbedUrl(provider, u, oembed.html ?? null);
  }

  // 2) OG fallback / enrichment
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
        try { base.cover_url = safeImageUrl(new URL(ogImg, cleaned).toString()); } catch { /* ignore */ }
      }
    }
  }

  // 3) Provider embed even when oEmbed didn't run
  if (!base.embed_url) base.embed_url = buildEmbedUrl(provider, u);

  // 4) YouTube thumbnail upgrade
  if (provider === "youtube") {
    const id = youtubeId(u);
    if (id) {
      const maxres = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
      const head = await safeFetch(maxres, { method: "HEAD" }, 2000);
      base.cover_url = head && head.ok ? maxres : `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
    }
  }

  // 4b) GitHub enrichment
  if (provider === "github") {
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (seg.length >= 2) {
      const owner = seg[0];
      const repo = seg[1].replace(/\.git$/, "");
      const res = await safeFetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
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
      base.cover_url = `https://opengraph.githubassets.com/1/${owner}/${repo}`;
      base.embed_url = null;
    }
  }

  // 5) Books
  if (isBookProvider(provider)) {
    let author: string | null = null;
    if (html) {
      author = pickJsonLdAuthor(html)
        ?? pickMeta(html, "books:author")
        ?? pickMeta(html, "book:author")
        ?? null;
    }
    if (!author && provider === "goodreads" && base.title?.includes(" by ")) {
      const parts = base.title.split(" by ");
      base.title = parts[0].trim();
      author = parts.slice(1).join(" by ").trim();
    }
    if (provider === "amazon" && base.title) {
      base.title = base.title.replace(/^Amazon\.[a-z.]+:\s*/i, "").trim();
    }
    const buyLabel = BOOK_PROVIDER_LABELS[provider] ?? "Buy";
    base.book = {
      author: author ?? base.author_name,
      buy_links: [{ label: buyLabel, url: cleaned }],
    };
    base.embed_url = null;
  }

  return base;
}
