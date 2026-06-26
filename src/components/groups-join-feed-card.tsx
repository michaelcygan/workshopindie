import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone, Radio, Shuffle, Sparkles } from "lucide-react";
import { listOpenForMyGroups, type MyGroupsFeedItem } from "@/lib/my-groups-feed.functions";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type Props = {
  hasGroups: boolean;
  onBrowseAll: () => void;
  className?: string;
};

const ROTATE_MS = 7000;

/**
 * Auto-rotating shuffle card that surfaces joinable collabs + workshops from
 * the rooms you're in. Paused on hover/focus. Lives in the left column of
 * the Groups index and stretches to align with the right grid.
 */
export function GroupsJoinFeedCard({ hasGroups, onBrowseAll, className }: Props) {
  const { user } = useAuth();
  const fetchFn = useServerFn(listOpenForMyGroups);
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups-feed", user?.id ?? "anon"],
    enabled: !!user && hasGroups,
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const items = useMemo<MyGroupsFeedItem[]>(() => data ?? [], [data]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIdx(0);
  }, [items.length]);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, ROTATE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, items.length]);

  const advance = () => {
    if (items.length === 0) return;
    setIdx((i) => (i + 1) % items.length);
  };

  const current = items[idx];

  return (
    <section
      className={cn(
        "flex h-full flex-col rounded-3xl border border-border bg-surface p-4 shadow-soft",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <h3 className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            From your groups
          </h3>
        </div>
        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-ink-muted">
              {idx + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={advance}
              aria-label="Shuffle to next"
              className="rounded-full border border-border bg-background p-1.5 text-ink-soft transition hover:bg-muted hover:text-ink"
            >
              <Shuffle className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {!user ? (
          <EmptyState
            title="Sign in to see live opportunities from your scenes."
            cta={
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Sign in <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : !hasGroups ? (
          <EmptyState
            title="Join a group to unlock collabs and Lounges from your scenes."
            cta={
              <button
                type="button"
                onClick={onBrowseAll}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Browse groups <ArrowRight className="h-3.5 w-3.5" />
              </button>
            }
          />
        ) : isLoading ? (
          <div className="flex flex-1 animate-pulse flex-col gap-3 px-1 py-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-5 w-3/4 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="mt-auto h-9 w-full rounded-full bg-muted" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Quiet in your groups right now."
            body="No open collabs or upcoming Lounges — yet."
            cta={
              <button
                type="button"
                onClick={onBrowseAll}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
              >
                Browse all groups
              </button>
            }
          />
        ) : current ? (
          <FeedItemView key={current.kind + current.id} item={current} onSkip={advance} canSkip={items.length > 1} />
        ) : null}
      </div>
    </section>
  );
}

function FeedItemView({
  item,
  onSkip,
  canSkip,
}: {
  item: MyGroupsFeedItem;
  onSkip: () => void;
  canSkip: boolean;
}) {
  const Icon = item.kind === "collab" ? Megaphone : Radio;
  const kindLabel = item.kind === "collab" ? "Collab" : "Lounge";
  const accent = item.group.accent_color ?? undefined;
  const href =
    item.kind === "collab"
      ? { to: "/collab/$slug", params: { slug: item.slug } }
      : { to: "/events/$slug", params: { slug: item.slug } };
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const startsLabel =
    item.kind === "workshop" && startsAt
      ? startsAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : null;

  return (
    <div
      key={item.id}
      className="flex flex-1 flex-col gap-3 px-1 py-1 duration-300 animate-in fade-in"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background"
          style={{ backgroundColor: accent ?? "var(--ink)" }}
        >
          <Icon className="h-2.5 w-2.5" />
          {kindLabel}
        </span>
        <Link
          to="/g/$slug"
          params={{ slug: item.group.slug }}
          className="inline-flex max-w-[180px] items-center rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-ink-soft transition hover:bg-muted hover:text-ink"
        >
          <span className="truncate">{item.group.name}</span>
        </Link>
        {startsLabel && (
          <span className="text-[11px] text-ink-muted">· {startsLabel}</span>
        )}
      </div>

      <h4 className="line-clamp-2 font-display text-[18px] leading-snug text-ink">
        {item.title}
      </h4>

      {item.subtitle && (
        <p className="line-clamp-3 text-[13px] leading-snug text-ink-soft">{item.subtitle}</p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2">
        <Link
          {...href}
          className="inline-flex flex-1 items-center justify-between gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          <span>Open</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {canSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body?: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 px-1 py-2">
      <p className="font-display text-[15px] leading-snug text-ink">{title}</p>
      {body && <p className="text-[12px] text-ink-muted">{body}</p>}
      {cta}
    </div>
  );
}
