/**
 * Pure-SVG dynamic Open Graph card generator.
 * Returns an SVG string that can be served as image/svg+xml from an edge worker.
 * No native binaries (no canvas, no resvg, no satori) so it runs safely on Cloudflare Workers.
 */

export type OgCardType = "profile" | "work" | "event" | "workshop" | "collab" | "city" | "blog" | "default";

export interface OgCardInput {
  type: OgCardType;
  title: string;
  subtitle?: string | null;
  image?: string | null;
  accent?: string | null;
  detail?: string | null;
}

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

const DEFAULT_GRADIENT = [
  ["#0f172a", 0],
  ["#1e293b", 50],
  ["#334155", 100],
] as const;

const ACCENTS: Record<string, string> = {
  film: "#f59e0b",
  music: "#ec4899",
  writing: "#8b5cf6",
  build: "#10b981",
  visual: "#3b82f6",
};

export function generateOgCard(input: OgCardInput): string {
  const { type, title, subtitle, image, accent, detail } = input;
  const safeTitle = escapeXml(truncate(title || "Workshop", 80));
  const safeSubtitle = escapeXml(truncate(subtitle || "", 140));
  const safeDetail = escapeXml(truncate(detail || "", 120));
  const accentColor = accent && ACCENTS[accent] ? ACCENTS[accent] : "#64748b";

  const gradientStops = DEFAULT_GRADIENT
    .map(([color, offset]) => `<stop offset="${offset}%" stop-color="${color}"/>`)
    .join("");

  const imageSection = image
    ? `<image x="620" y="60" width="520" height="510" preserveAspectRatio="xMidYMid slice" href="${escapeXml(image)}" clip-path="url(#photoClip)"/>`
    : "";

  const subtitleSection = safeSubtitle
    ? `<text x="80" y="340" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="32" fill="#e2e8f0" font-weight="400">${safeSubtitle}</text>`
    : "";

  const detailSection = safeDetail
    ? `<text x="80" y="540" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="24" fill="#94a3b8" font-weight="400">${safeDetail}</text>`
    : "";

  const typeLabel = type === "default" ? "Workshop" : type.charAt(0).toUpperCase() + type.slice(1);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      ${gradientStops}
    </linearGradient>
    <clipPath id="photoClip">
      <rect x="620" y="60" width="520" height="510" rx="28" />
    </clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <rect x="0" y="0" width="8" height="${HEIGHT}" fill="${accentColor}" />
  <rect x="60" y="60" width="520" height="8" rx="4" fill="${accentColor}" opacity="0.8" />
  <text x="80" y="130" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="18" fill="${accentColor}" font-weight="600" letter-spacing="2">${escapeXml(typeLabel.toUpperCase())}</text>
  <text x="80" y="230" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="64" fill="#f8fafc" font-weight="700">${safeTitle}</text>
  ${subtitleSection}
  ${imageSection}
  ${detailSection}
  <text x="1120" y="580" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22" fill="#64748b" font-weight="600">workshopindie.com</text>
</svg>`;
}
