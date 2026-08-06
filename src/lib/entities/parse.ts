/**
 * The single Workshop reference parser.
 *
 * Message bodies across Today, Lounge and DMs store references as ordinary
 * markdown links pointing at canonical Workshop paths (`[Label](/works/slug)`).
 * Three surfaces used to tokenize that format with three near-identical copies
 * of these regexes, and they had drifted — chat/DM never recognised Works, so a
 * Work mentioned there rendered as raw markdown. This module is now the only
 * tokenizer; surfaces differ only by render and by options.
 *
 * Client-safe, framework-free.
 */

import type { WorkshopEntityKind } from "./kinds";

/** Kinds that can appear inline inside a message body. */
export type InlineEntityKind = Extract<
  WorkshopEntityKind,
  "work" | "collab" | "group" | "event" | "post"
>;

export type EntitySegment =
  | { type: "text"; value: string }
  | { type: "mention"; username: string }
  | {
      type: "entity";
      kind: InlineEntityKind;
      label: string;
      slug: string;
      /** Only present for events. */
      groupSlug?: string;
    }
  | { type: "url"; href: string; text: string };

export type ParseOptions = {
  /**
   * Also autolink bare hostnames like `www.example.com` (no scheme).
   * Chat/DM historically did this; the Today board did not.
   */
  bareUrls?: boolean;
};

const EVENT_LINK_RE =
  /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\/e\/([a-zA-Z0-9_-]{1,80})\)/g;
const GROUP_LINK_RE = /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\)/g;
const COLLAB_LINK_RE = /\[([^\]\n]{1,120})\]\(\/collab\/([a-zA-Z0-9_-]{1,80})\)/g;
const WORK_LINK_RE = /\[([^\]\n]{1,120})\]\(\/works\/([a-zA-Z0-9_-]{1,80})\)/g;
const POST_LINK_RE = /\[([^\]\n]{1,120})\]\(\/blog\/([a-zA-Z0-9_-]{1,120})\)/g;
const MENTION_RE = /(^|\s)@([a-zA-Z0-9_]{2,30})/g;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;
const BARE_URL_RE =
  /\b(?:www\.[^\s<]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<]*)?)/gi;

type Hit = { start: number; end: number; seg: EntitySegment };

function overlaps(hits: Hit[], start: number, end = start + 1): boolean {
  return hits.some((h) => start < h.end && end > h.start);
}

/** Tokenize a message body into text, mentions, entity references and links. */
export function parseEntityBody(body: string, opts: ParseOptions = {}): EntitySegment[] {
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;

  // Events first: the group regex is a prefix-superset of the event one.
  EVENT_LINK_RE.lastIndex = 0;
  while ((m = EVENT_LINK_RE.exec(body)) !== null) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "entity", kind: "event", label: m[1], slug: m[3], groupSlug: m[2] },
    });
  }

  const simple: Array<[RegExp, InlineEntityKind]> = [
    [GROUP_LINK_RE, "group"],
    [COLLAB_LINK_RE, "collab"],
    [WORK_LINK_RE, "work"],
    [POST_LINK_RE, "post"],
  ];
  for (const [re, kind] of simple) {
    re.lastIndex = 0;
    while ((m = re.exec(body)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(hits, start, end)) continue;
      hits.push({ start, end, seg: { type: "entity", kind, label: m[1], slug: m[2] } });
    }
  }

  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(body)) !== null) {
    const raw = m[0].replace(/[),.;!?]+$/g, "");
    const start = m.index;
    const end = start + raw.length;
    if (overlaps(hits, start, end)) continue;
    hits.push({ start, end, seg: { type: "url", href: raw, text: raw } });
  }

  if (opts.bareUrls) {
    BARE_URL_RE.lastIndex = 0;
    while ((m = BARE_URL_RE.exec(body)) !== null) {
      const raw = m[0].replace(/[),.;!?]+$/g, "");
      const start = m.index;
      const end = start + raw.length;
      if (/^https?:\/\//i.test(raw)) continue;
      if (overlaps(hits, start, end)) continue;
      let href: string;
      try {
        const u = new URL(`https://${raw}`);
        if (!u.hostname.includes(".")) continue;
        href = u.toString();
      } catch {
        continue;
      }
      hits.push({ start, end, seg: { type: "url", href, text: raw } });
    }
  }

  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) {
    const at = m.index + (m[1] ? m[1].length : 0);
    const end = at + 1 + m[2].length;
    if (overlaps(hits, at, end)) continue;
    hits.push({ start: at, end, seg: { type: "mention", username: m[2] } });
  }

  hits.sort((a, b) => a.start - b.start);

  const out: EntitySegment[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    if (h.start > cursor) out.push({ type: "text", value: body.slice(cursor, h.start) });
    out.push(h.seg);
    cursor = h.end;
  }
  if (cursor < body.length) out.push({ type: "text", value: body.slice(cursor) });
  return out;
}

/** Strip inline entity links back to their plain labels (snippets, previews). */
export function flattenEntityBody(body: string): string {
  return body
    .replace(EVENT_LINK_RE, (_f, label: string) => label)
    .replace(GROUP_LINK_RE, (_f, label: string) => label)
    .replace(COLLAB_LINK_RE, (_f, label: string) => label)
    .replace(WORK_LINK_RE, (_f, label: string) => label)
    .replace(POST_LINK_RE, (_f, label: string) => label);
}

/** Extract `@username` tokens (deduped, lowercased). */
export function extractBodyMentions(body: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(body)) !== null) out.add(m[2].toLowerCase());
  return Array.from(out);
}
