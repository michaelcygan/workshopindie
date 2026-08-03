import { useMemo } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { extractUrls, isBlockedUrl } from "@/lib/moderation/url-blocklist";

export type SharedLinkMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type LinkCard = {
  url: string;
  host: string;
  snippet: string;
  senderName: string;
  senderId: string;
  createdAt: string;
  count: number;
};

function normalizeKey(url: string): string {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")
    ).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * Presentational list of every URL shared in a conversation.
 *
 * Transport-agnostic: callers pass plain messages and a sender-name resolver,
 * so this works for Group Today posts and for legacy Lounge chat alike.
 * Defense-in-depth: any URL matching the shared blocklist is filtered out, so
 * pre-existing messages can't surface unsafe links here.
 */
export function SharedLinksList({
  messages,
  resolveSenderName,
  emptyTitle = "No links shared yet",
  emptyHint = "Paste a link in the conversation and it'll show up here.",
  className,
}: {
  messages: SharedLinkMessage[];
  resolveSenderName: (userId: string) => string;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
}) {
  const cards = useMemo<LinkCard[]>(() => {
    const byKey = new Map<string, LinkCard>();
    for (const msg of messages) {
      const urls = extractUrls(msg.body);
      if (!urls.length) continue;
      const senderName = resolveSenderName(msg.user_id);
      const snippet =
        msg.body.length > 140 ? `${msg.body.slice(0, 140).trim()}…` : msg.body;
      for (const raw of urls) {
        if (isBlockedUrl(raw)) continue;
        const key = normalizeKey(raw);
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          if (new Date(msg.created_at) > new Date(existing.createdAt)) {
            existing.createdAt = msg.created_at;
            existing.senderName = senderName;
            existing.senderId = msg.user_id;
            existing.snippet = snippet;
          }
          continue;
        }
        byKey.set(key, {
          url: raw,
          host: hostOf(raw),
          snippet,
          senderName,
          senderId: msg.user_id,
          createdAt: msg.created_at,
          count: 1,
        });
      }
    }
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, resolveSenderName]);

  if (cards.length === 0) {
    return (
      <div
        className={`flex h-full min-h-[240px] flex-col items-center justify-center px-6 py-10 text-center ${className ?? ""}`}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted/60 text-ink-muted">
          <Link2 className="h-4 w-4" />
        </div>
        <h3 className="mt-3 font-display text-base text-ink">{emptyTitle}</h3>
        <p className="mt-1 max-w-xs text-sm text-ink-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className={`flex flex-col gap-2 ${className ?? ""}`}>
      {cards.map((c) => (
        <li
          key={c.url}
          className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-border-strong hover:shadow-soft"
        >
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(c.host)}&sz=64`}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            className="mt-0.5 h-5 w-5 shrink-0 rounded"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-ink">{c.host}</span>
              {c.count > 1 && (
                <span className="shrink-0 rounded-full bg-muted/70 px-1.5 py-0.5 text-[10px] text-ink-muted">
                  shared {c.count}×
                </span>
              )}
            </div>
            {c.snippet && (
              <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-ink-soft">
                {c.snippet}
              </p>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="truncate">{c.senderName}</span>
              <span aria-hidden>·</span>
              <span>{timeAgo(c.createdAt)}</span>
            </div>
          </div>
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-ink transition hover:bg-muted/60"
            aria-label={`Open ${c.host} in a new tab`}
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}
