import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Match: [label](href) — href may be internal (/...) or absolute (http/https).
const MD_LINK = /\[([^\]]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g;
// Also auto-linkify bare URLs and internal /paths surrounded by whitespace.
const BARE_URL = /(https?:\/\/[^\s<]+)/g;

/**
 * Render a plain-text string with markdown-style links `[label](href)` and
 * bare URLs turned into clickable links. Internal paths (starting with `/`)
 * use TanStack Router's <Link>; external URLs open in a new tab.
 *
 * Whitespace is preserved by the caller (use `whitespace-pre-wrap` on the
 * wrapping element).
 */
export function renderLinks(text: string): ReactNode[] {
  if (!text) return [];
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // First pass: markdown links.
  const pushPlain = (chunk: string) => {
    if (!chunk) return;
    // Second pass on the plain segment: bare URLs.
    let last = 0;
    let m: RegExpExecArray | null;
    BARE_URL.lastIndex = 0;
    while ((m = BARE_URL.exec(chunk)) !== null) {
      if (m.index > last) nodes.push(chunk.slice(last, m.index));
      const url = m[1];
      nodes.push(
        <a
          key={`u-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {url}
        </a>,
      );
      last = m.index + url.length;
    }
    if (last < chunk.length) nodes.push(chunk.slice(last));
  };

  let match: RegExpExecArray | null;
  MD_LINK.lastIndex = 0;
  while ((match = MD_LINK.exec(text)) !== null) {
    if (match.index > lastIndex) pushPlain(text.slice(lastIndex, match.index));
    const [, label, href] = match;
    if (href.startsWith("/")) {
      nodes.push(
        <Link
          key={`l-${key++}`}
          to={href}
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {label}
        </Link>,
      );
    } else {
      nodes.push(
        <a
          key={`l-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {label}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushPlain(text.slice(lastIndex));
  return nodes;
}
