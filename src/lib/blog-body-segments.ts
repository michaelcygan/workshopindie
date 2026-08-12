/**
 * Shared parser for Workshop's Markdown-light blog body format.
 *
 * The canonical stored representation is a single Markdown string that may
 * contain full-line embed or image markers:
 *
 *   Paragraph one.
 *
 *   [[embed:https://example.com]]
 *
 *   [[image:https://cdn/pic.jpg|alt=A%20studio|caption=Backstage|link=https%3A%2F%2Fx.com]]
 *
 *   Paragraph two.
 *
 * Both the public renderer (`BlogPostBody`) and the composer (`BlogBodyEditor`)
 * parse with these helpers so the two can never drift.
 */

export type BlogImageMeta = {
  url: string;
  alt?: string;
  caption?: string;
  credit?: string;
  /** Optional click-through destination; when absent the image opens a lightbox. */
  link?: string;
};

export type BlogGalleryItem = { url: string; alt?: string };

export type BlogGalleryLayout = "wall" | "slideshow";

export type BlogGallery = {
  items: BlogGalleryItem[];
  layout: BlogGalleryLayout;
  caption?: string;
};

export type BodySegment =
  | { type: "text"; text: string }
  | { type: "embed"; url: string }
  | { type: "image"; image: BlogImageMeta }
  | { type: "gallery"; gallery: BlogGallery };

export const EMBED_LINE = /^[ \t]*\[\[embed:(\S+?)\]\][ \t]*$/;
export const IMAGE_LINE = /^[ \t]*\[\[image:([^\]]+)\]\][ \t]*$/;
export const GALLERY_LINE = /^[ \t]*\[\[gallery:([^\]]+)\]\][ \t]*$/;

export const MAX_GALLERY_ITEMS = 12;


const META_KEYS = ["alt", "caption", "credit", "link"] as const;
type MetaKey = (typeof META_KEYS)[number];

function decode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Parses the inner payload of an `[[image:…]]` marker. */
export function parseImageMarker(payload: string): BlogImageMeta | null {
  const parts = payload.split("|");
  const url = decode((parts.shift() ?? "").trim());
  if (!url) return null;
  const out: BlogImageMeta = { url };
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim() as MetaKey;
    if (!(META_KEYS as readonly string[]).includes(key)) continue;
    const value = decode(part.slice(eq + 1).trim());
    if (value) out[key] = value;
  }
  return out;
}

/** Serializes image metadata back into a single-line `[[image:…]]` marker. */
export function serializeImageMarker(image: BlogImageMeta): string {
  const parts = [encodeURIComponent(image.url)];
  for (const key of META_KEYS) {
    const value = (image[key] ?? "").trim();
    if (value) parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return `[[image:${parts.join("|")}]]`;
}

/**
 * Parses the inner payload of a `[[gallery:…]]` marker. Each photo is an
 * `img=<url>~<alt>` part; `layout` and `caption` are plain key/value parts.
 */
export function parseGalleryMarker(payload: string): BlogGallery | null {
  const items: BlogGalleryItem[] = [];
  let layout: BlogGalleryLayout = "wall";
  let caption: string | undefined;
  for (const raw of payload.split("|")) {
    const part = raw.trim();
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "img") {
      const [u, a] = value.split("~");
      const url = decode(u ?? "");
      if (!url) continue;
      const alt = a ? decode(a) : "";
      items.push(alt ? { url, alt } : { url });
    } else if (key === "layout") {
      layout = value === "slideshow" ? "slideshow" : "wall";
    } else if (key === "caption") {
      const c = decode(value);
      if (c) caption = c;
    }
  }
  if (items.length === 0) return null;
  return caption
    ? { items: items.slice(0, MAX_GALLERY_ITEMS), layout, caption }
    : { items: items.slice(0, MAX_GALLERY_ITEMS), layout };
}

/** Serializes a gallery back into a single-line `[[gallery:…]]` marker. */
export function serializeGalleryMarker(gallery: BlogGallery): string {
  const parts: string[] = [`layout=${gallery.layout === "slideshow" ? "slideshow" : "wall"}`];
  const caption = (gallery.caption ?? "").trim();
  if (caption) parts.push(`caption=${encodeURIComponent(caption)}`);
  for (const item of gallery.items.slice(0, MAX_GALLERY_ITEMS)) {
    const alt = (item.alt ?? "").trim();
    parts.push(`img=${encodeURIComponent(item.url)}${alt ? `~${encodeURIComponent(alt)}` : ""}`);
  }
  return `[[gallery:${parts.join("|")}]]`;
}



/**
 * Splits body Markdown into an alternating text / block sequence. The result
 * always starts and ends with a text segment (possibly empty) so callers can
 * rely on there being a text slot before and after every block.
 */
export function parseSegments(markdown: string): BodySegment[] {
  const lines = (markdown ?? "").split("\n");
  const out: BodySegment[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    const embed = line.match(EMBED_LINE);
    if (embed) {
      out.push({ type: "text", text: buf.join("\n") });
      out.push({ type: "embed", url: embed[1] });
      buf = [];
      continue;
    }
    const img = line.match(IMAGE_LINE);
    const image = img ? parseImageMarker(img[1]) : null;
    if (image) {
      out.push({ type: "text", text: buf.join("\n") });
      out.push({ type: "image", image });
      buf = [];
      continue;
    }
    const gal = line.match(GALLERY_LINE);
    const gallery = gal ? parseGalleryMarker(gal[1]) : null;
    if (gallery) {
      out.push({ type: "text", text: buf.join("\n") });
      out.push({ type: "gallery", gallery });
      buf = [];
      continue;
    }
    buf.push(line);

  }
  out.push({ type: "text", text: buf.join("\n") });
  return out;
}

/** Removes blank leading/trailing lines while preserving interior blank lines. */
export function trimBlankLines(text: string): string {
  return (text ?? "").replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "");
}

/**
 * Serializes segments back into canonical body Markdown: blocks separated by a
 * single blank line, markers always on their own line, no orphaned markers and
 * no runs of empty blocks.
 */
export function serializeSegments(segments: BodySegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === "embed") {
      parts.push(`[[embed:${seg.url}]]`);
    } else if (seg.type === "image") {
      parts.push(serializeImageMarker(seg.image));
    } else {
      const t = trimBlankLines(seg.text);
      if (t.length) parts.push(t);
    }
  }
  return parts.join("\n\n");
}
