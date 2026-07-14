import { useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";

const MD_LINK = /\[([^\]]+)\]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /(https?:\/\/[^\s<]+)/g;

function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    router.navigate({ to: href });
  }
  return (
    <a
      href={href}
      onClick={onClick}
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

/**
 * Render a plain-text string with markdown-style links `[label](href)` and
 * bare URLs. Internal paths (starting with `/`) navigate via the client
 * router; external URLs open in a new tab. Whitespace is preserved by the
 * caller (use `whitespace-pre-wrap` on the wrapping element).
 */
export function RenderLinks({ text }: { text: string }) {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const pushPlain = (chunk: string) => {
    if (!chunk) return;
    let last = 0;
    let m: RegExpExecArray | null;
    BARE_URL.lastIndex = 0;
    while ((m = BARE_URL.exec(chunk)) !== null) {
      if (m.index > last) nodes.push(chunk.slice(last, m.index));
      const url = m[1];
      nodes.push(<ExternalLink key={`u-${key++}`} href={url}>{url}</ExternalLink>);
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
      nodes.push(<InternalLink key={`l-${key++}`} href={href}>{label}</InternalLink>);
    } else {
      nodes.push(<ExternalLink key={`l-${key++}`} href={href}>{label}</ExternalLink>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushPlain(text.slice(lastIndex));

  return <>{nodes}</>;
}
