/**
 * Share (Open Graph / Twitter) image helpers.
 *
 * Why this exists: link-preview crawlers (Reddit, X, Facebook, LinkedIn,
 * Slack, Discord, iMessage) only accept JPEG, PNG, GIF or WEBP. Workshop used
 * to point every page at an SVG card endpoint, so no preview thumbnail ever
 * rendered anywhere. Pages now share the entity's own cover photo, and fall
 * back to one static branded PNG when there isn't one.
 */

export const SITE = "https://workshopindie.com";

/** Static branded card. Real PNG, 1200x630 — safe on every platform. */
export const OG_FALLBACK = `${SITE}/brand/og-default.png`;
export const OG_FALLBACK_WIDTH = "1200";
export const OG_FALLBACK_HEIGHT = "630";

const RASTER = /\.(jpe?g|png|gif|webp)(\?|#|$)/i;

/**
 * Absolute https raster URL for a candidate cover, or the branded fallback.
 * SVGs, data URIs, relative paths and http URLs are rejected: crawlers either
 * refuse them or can't fetch them.
 */
export function shareImage(candidate?: string | null): string {
  const url = candidate?.trim();
  if (!url) return OG_FALLBACK;
  if (url.startsWith("/")) return `${SITE}${url}`;
  if (!url.startsWith("https://")) return OG_FALLBACK;
  // Storage/CDN URLs without an extension are still served as real images;
  // only reject the formats we know crawlers drop.
  if (/\.svg(\?|#|$)/i.test(url)) return OG_FALLBACK;
  return url;
}

function mimeFor(url: string): string | null {
  const m = url.match(RASTER);
  if (!m) return null;
  const ext = m[1]!.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return `image/${ext}`;
}

/**
 * Full set of image meta tags for a page. Pass the entity's cover/avatar;
 * omit or pass null to use the branded fallback.
 */
export function shareImageMeta(
  candidate?: string | null,
  alt?: string | null,
): Array<Record<string, string>> {
  const img = shareImage(candidate);
  const isFallback = img === OG_FALLBACK;
  const type = mimeFor(img);
  const meta: Array<Record<string, string>> = [
    { property: "og:image", content: img },
    { property: "og:image:secure_url", content: img },
  ];
  if (type) meta.push({ property: "og:image:type", content: type });
  if (isFallback) {
    meta.push(
      { property: "og:image:width", content: OG_FALLBACK_WIDTH },
      { property: "og:image:height", content: OG_FALLBACK_HEIGHT },
    );
  }
  meta.push(
    { property: "og:image:alt", content: alt?.trim() || "Workshop" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: img },
    { name: "twitter:image:alt", content: alt?.trim() || "Workshop" },
  );
  return meta;
}
