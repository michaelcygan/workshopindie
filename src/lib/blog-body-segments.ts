/**
 * Shared parser for Workshop's Markdown-light blog body format.
 *
 * The canonical stored representation is a single Markdown string that may
 * contain full-line embed markers:
 *
 *   Paragraph one.
 *
 *   [[embed:https://example.com]]
 *
 *   Paragraph two.
 *
 * Both the public renderer (`BlogPostBody`) and the composer (`BlogBodyEditor`)
 * parse with these helpers so the two can never drift.
 */

export type BodySegment =
  | { type: "text"; text: string }
  | { type: "embed"; url: string };

export const EMBED_LINE = /^[ \t]*\[\[embed:(\S+?)\]\][ \t]*$/;

/**
 * Splits body Markdown into an alternating text / embed sequence. The result
 * always starts and ends with a text segment (possibly empty) so callers can
 * rely on there being a text slot before and after every embed.
 */
export function parseSegments(markdown: string): BodySegment[] {
  const lines = (markdown ?? "").split("\n");
  const out: BodySegment[] = [];
  let buf: string[] = [];
  for (const line of lines) {
    const m = line.match(EMBED_LINE);
    if (m) {
      out.push({ type: "text", text: buf.join("\n") });
      out.push({ type: "embed", url: m[1] });
      buf = [];
    } else {
      buf.push(line);
    }
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
 * single blank line, embeds always on their own line, no orphaned markers and
 * no runs of empty blocks.
 */
export function serializeSegments(segments: BodySegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === "embed") {
      parts.push(`[[embed:${seg.url}]]`);
    } else {
      const t = trimBlankLines(seg.text);
      if (t.length) parts.push(t);
    }
  }
  return parts.join("\n\n");
}
