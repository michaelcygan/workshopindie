import { CATEGORIES } from "@/lib/categories";

/**
 * Normalize a live-room title for display.
 * Rewrites legacy "Instant Workshop[: X]" titles into the user-facing
 * "Lounge: X" convention. Host-set titles pass through.
 */
export function formatRoomTitle(
  title: string | null | undefined,
  medium?: string | null,
): string {
  const t = (title ?? "").trim();
  const match = t.match(/^(?:instant\s+workshop|workshop)(?:\s*[:\-–]\s*(.*))?$/i);
  if (match) {
    const captured = match[1]?.trim();
    const label =
      captured ||
      (medium ? CATEGORIES.find((c) => c.id === medium)?.label : undefined);
    return label ? `Lounge: ${label}` : "Lounge";
  }
  return t || "Lounge";
}
