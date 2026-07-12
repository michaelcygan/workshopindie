import { Link } from "@tanstack/react-router";
import { Fragment, type ReactNode } from "react";
import { Calendar, Megaphone, Users } from "lucide-react";
import { isBlockedHost, isShortenerHost } from "@/lib/link-blocklist";
import { UsernameMention } from "@/components/username-mention";
import { GroupPeek } from "@/components/group-peek";
import { EventPeek } from "@/components/event-peek";

/**
 * Parse a chat / Today post body into renderable segments.
 * Supports:
 *  - @username mentions                    → ProfilePeek chip (via UsernameMention)
 *  - [Label](/collab/slug) inline links     → collab pill + link
 *  - [Label](/g/slug) inline links          → group pill + hover peek
 *  - [Label](/g/slug/e/eventSlug) links     → event pill + hover peek
 *  - Bare URLs (http/https)                 → autolinked with soft censoring
 */

type Segment =
  | { type: "text"; value: string }
  | { type: "mention"; username: string }
  | { type: "collab"; label: string; slug: string }
  | { type: "group"; label: string; slug: string }
  | { type: "event"; label: string; groupSlug: string; eventSlug: string }
  | { type: "url"; href: string };

const EVENT_LINK_RE =
  /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\/e\/([a-zA-Z0-9_-]{1,80})\)/g;
const GROUP_LINK_RE = /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\)/g;
const COLLAB_LINK_RE = /\[([^\]\n]{1,120})\]\(\/collab\/([a-zA-Z0-9_-]{1,80})\)/g;
const MENTION_RE = /(^|\s)@([a-zA-Z0-9_]{2,30})/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;

function tokenize(body: string): Segment[] {
  type Hit = { start: number; end: number; seg: Segment };
  const hits: Hit[] = [];

  let m: RegExpExecArray | null;
  EVENT_LINK_RE.lastIndex = 0;
  while ((m = EVENT_LINK_RE.exec(body)) !== null) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "event", label: m[1], groupSlug: m[2], eventSlug: m[3] },
    });
  }
  GROUP_LINK_RE.lastIndex = 0;
  while ((m = GROUP_LINK_RE.exec(body)) !== null) {
    // Skip if already captured as an event (event regex is a superset).
    if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "group", label: m[1], slug: m[2] },
    });
  }
  COLLAB_LINK_RE.lastIndex = 0;
  while ((m = COLLAB_LINK_RE.exec(body)) !== null) {
    if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "collab", label: m[1], slug: m[2] },
    });
  }
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(body)) !== null) {
    if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "url", href: m[0] },
    });
  }
  MENTION_RE.lastIndex = 0;
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
        <UsernameMention key={i} handle={s.username}>
          <button
            type="button"
            className="rounded px-0.5 font-medium text-primary hover:underline"
          >
            @{s.username}
          </button>
        </UsernameMention>
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
    if (s.type === "group") {
      return (
        <GroupPeek key={i} slug={s.slug}>
          <Link
            to="/g/$slug"
            params={{ slug: s.slug }}
            className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-violet/30 bg-violet/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-violet hover:bg-violet/10"
          >
            <Users className="h-3 w-3" />
            {s.label}
          </Link>
        </GroupPeek>
      );
    }
    if (s.type === "event") {
      return (
        <EventPeek key={i} groupSlug={s.groupSlug} eventSlug={s.eventSlug}>
          <Link
            to="/g/$slug/e/$eventSlug"
            params={{ slug: s.groupSlug, eventSlug: s.eventSlug }}
            className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-coral/30 bg-coral/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-coral hover:bg-coral/10"
          >
            <Calendar className="h-3 w-3" />
            {s.label}
          </Link>
        </EventPeek>
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

/** Strip markdown links (collab/group/event) to plain labels for snippets. */
export function flattenTodayBodyToText(body: string): string {
  return body
    .replace(EVENT_LINK_RE, (_f, label: string) => label)
    .replace(GROUP_LINK_RE, (_f, label: string) => label)
    .replace(COLLAB_LINK_RE, (_f, label: string) => label);
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
