// Shared (client + server) excerpt generation from Markdown-light bodies.
// The server is authoritative at publish time; the editor preview reuses this
// so authors see exactly what will be stored.

export const EXCERPT_TARGET_LENGTH = 180;

/** Convert Markdown-light to readable plain text. */
export function markdownToPlainText(md: string): string {
  let t = md ?? "";
  // Embed markers and images first (they carry URLs we never want in prose).
  t = t.replace(/\[\[embed:[^\]]*\]\]/g, " ");
  t = t.replace(/\[\[image:[^\]]*\]\]/g, " ");
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  // Links: keep the label, drop the URL.
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Fenced + inline code.
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]*)`/g, "$1");
  // Block markers at line starts: headings, quotes, list bullets, numbers, rules.
  t = t.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, "");
  t = t.replace(/^\s{0,3}([-*_]\s*){3,}$/gm, " ");
  // Emphasis / strikethrough characters.
  t = t.replace(/(\*\*|__|\*|_|~~)/g, "");
  // Bare autolinks.
  t = t.replace(/<([^>]*)>/g, "$1");
  // Collapse whitespace.
  return t.replace(/\s+/g, " ").trim();
}

/** Build an excerpt of roughly `max` characters, truncated on a word boundary. */
export function generateExcerpt(bodyMarkdown: string, max = EXCERPT_TARGET_LENGTH): string {
  const text = markdownToPlainText(bodyMarkdown);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.!?-]+$/, "")}…`;
}
