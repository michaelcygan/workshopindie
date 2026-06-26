import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { Megaphone } from "lucide-react";
import { isBlockedHost, isShortenerHost } from "@/lib/link-blocklist";

/**
 * Parse a Today chat body into renderable segments.
 * Supports:
 *  - @username mentions  →  link to /u/$username
 *  - [Label](/collab/slug) inline collab links →  pill with megaphone icon
 *  - Bare URLs (http/https) → autolinked with soft censoring
 */

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; username: string }
  | { type: "collab"; label: string; slug: string }
  | { type: "url"; href: string };

const COLLAB_LINK_RE = /\[([^\]\n]{1,80})\]\((\/collab\/[a-zA-Z0-9_-]{1,80})\)/g;
const MENTION_RE = /(^|\s)@([a-zA-Z0-9_]{2,30})/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;

function tokenize(body: string): Segment[] {
  type Hit = { start: number; end: number; seg: Segment };
  const hits: Hit[] = [];

  let m: RegExpExecArray | null;
  while ((m = COLLAB_LINK_RE.exec(body)) !== null) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "collab", label: m[1], slug: m[2].replace(/^\/collab\//, "") },
    });
  }
  while ((m = URL_RE.exec(body)) !== null) {
    // Skip URLs that were already captured inside a markdown collab link
    if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "url", href: m[0] },
    });
  }
  while ((m = MENTION_RE.exec(body)) !== null) {
    const at = m.index + (m[1] ? m[1].length : 0);
    const end = at + 1 + m[2].length;
    if (hits.some((h) => at >= h.start && at < h.end)) continue;
    hits.push({ start: at, end, seg: { type: "mention", username: m[2] } });
  }

  hits.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) {
      out.push({ type: "text", value: body.slice(cursor, h.start) });
    }
    out.push(h.seg);
    cursor = h.end;
  }
  if (cursor < body.length) {
    out.push({ type: "text", value: body.slice(cursor) });
  }
  return out;
}

function truncateMiddle(s: string, max = 60): string {
  if (s.length <= max) return s;
  const keep = Math.floor((max - 1) / 2);
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

export function renderTodayBody(body: string): ReactNode {
  const segments = tokenize(body);
  return segments.map((s, i) => {
    if (s.type === "text") {
      return <Fragment key={i}>{s.value}</Fragment>;
    }
    if (s.type === "mention") {
      return (
        <Link
          key={i}
          to="/u/$username"
          params={{ username: s.username }}
          className="rounded px-0.5 font-medium text-primary hover:underline"
        >
          @{s.username}
        </Link>
      );
    }
    if (s.type === "collab") {
      return (
        <Link
          key={i}
          to="/collab/$slug"
          params={{ slug: s.slug }}
          className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-primary hover:bg-primary/10"
        >
          <Megaphone className="h-3 w-3" />
          {s.label}
        </Link>
      );
    }
    // URL
    let host = "";
    try {
      host = new URL(s.href).host;
    } catch {
      return <Fragment key={i}>{s.href}</Fragment>;
    }
    if (isBlockedHost(host)) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-flex items-center rounded-full bg-muted px-2 py-0.5 align-baseline text-[12px] text-ink-muted"
          title="Hidden by Workshop · adult / unsafe domain"
        >
          link hidden · adult content
        </span>
      );
    }
    const flagged = isShortenerHost(host);
    return (
      <a
        key={i}
        href={s.href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="break-words text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        title={flagged ? `Shortener · resolves through ${host}` : s.href}
      >
        {flagged ? "⚠︎ " : ""}
        {truncateMiddle(s.href.replace(/^https?:\/\//, ""))}
      </a>
    );
  });
}

/** Strip markdown collab-links to plain titles for snippets / notifications. */
export function flattenTodayBodyToText(body: string): string {
  return body.replace(COLLAB_LINK_RE, (_full, label: string) => label);
}

/** Extract @username tokens (deduped, lowercase). */
export function extractMentions(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) {
    out.add(m[2].toLowerCase());
  }
  return Array.from(out);
}
