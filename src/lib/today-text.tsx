import { Fragment, type ReactNode } from "react";
import { isBlockedHost, isShortenerHost } from "@/lib/link-blocklist";
import { UsernameMention } from "@/components/username-mention";
import { EntityReferenceChip } from "@/components/entity/entity-reference-chip";
import {
  parseEntityBody,
  flattenEntityBody,
  extractBodyMentions,
} from "@/lib/entities/parse";

/**
 * Today board body renderer.
 *
 * Tokenizing now lives in `@/lib/entities/parse` and reference chips in
 * `EntityReferenceChip`, shared with Lounge chat and DMs. This file only adds
 * the Today-specific URL treatment (blocklist censoring, shortener warning).
 */

function truncateMiddle(s: string, max = 60): string {
  if (s.length <= max) return s;
  const keep = Math.floor((max - 1) / 2);
  return `${s.slice(0, keep)}…${s.slice(s.length - keep)}`;
}

export function renderTodayBody(body: string): ReactNode {
  return parseEntityBody(body).map((s, i) => {
    if (s.type === "text") return <Fragment key={i}>{s.value}</Fragment>;
    if (s.type === "mention") {
      return (
        <UsernameMention key={i} handle={s.username}>
          <button type="button" className="rounded px-0.5 font-medium text-primary hover:underline">
            @{s.username}
          </button>
        </UsernameMention>
      );
    }
    if (s.type === "entity") {
      return (
        <EntityReferenceChip
          key={i}
          kind={s.kind}
          label={s.label}
          slug={s.slug}
          groupSlug={s.groupSlug}
        />
      );
    }
    return <UrlSegment key={i} href={s.href} />;
  });
}

function UrlSegment({ href }: { href: string }) {
  let host = "";
  try {
    host = new URL(href).host;
  } catch {
    return <>{href}</>;
  }
  if (isBlockedHost(host)) {
    return (
      <span
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
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="break-words text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      title={flagged ? `Shortener · resolves through ${host}` : href}
    >
      {flagged ? "⚠︎ " : ""}
      {truncateMiddle(href.replace(/^https?:\/\//, ""))}
    </a>
  );
}

/** Strip markdown links (collab/work/group/event/post) to plain labels. */
export const flattenTodayBodyToText = flattenEntityBody;

/** Extract @username tokens (deduped, lowercase). */
export const extractMentions = extractBodyMentions;
