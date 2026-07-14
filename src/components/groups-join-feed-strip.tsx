import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone, Radio, Sparkles } from "lucide-react";
import { listOpenForMyGroups, type MyGroupsFeedItem } from "@/lib/my-groups-feed.functions";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  hasGroups: boolean;
  onBrowseAll: () => void;
};

/**
 * Bottom marquee-style strip of joinable collabs + workshops drawn from every
 * group the user is in. Mirrors the top SceneTicker pattern: edge-faded,
 * infinite-loop drift, pauses on hover. Each item is a real link.
 */
export function GroupsJoinFeedStrip({ hasGroups, onBrowseAll }: Props) {
  const { user } = useAuth();
  const fetchFn = useServerFn(listOpenForMyGroups);
  const { data, isLoading } = useQuery({
    queryKey: ["my-groups-feed", user?.id ?? "anon"],
    enabled: !!user && hasGroups,
    queryFn: () => fetchFn(),
    staleTime: 60_000,
  });

  const items = useMemo<MyGroupsFeedItem[]>(() => data ?? [], [data]);

  // Empty/auth states render as a single inline line (no marquee).
  if (!user || !hasGroups || isLoading || items.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface px-4 py-3 shadow-soft">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            From your groups
          </span>
          <span className="truncate text-sm text-ink-soft">
            {!user
              ? "Sign in to surface live collabs and Lounges from your scenes."
              : !hasGroups
                ? "Join a group to unlock live collabs and Lounges from your scenes."
                : isLoading
                  ? "Loading what's open in your scenes…"
                  : "Quiet in your scenes right now."}
          </span>
        </div>
        {!user ? (
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
          >
            Sign in <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBrowseAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
          >
            Browse groups <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  const loop = [...items, ...items];

  return (
    <section
      aria-label="Live opportunities in your groups"
      className="rounded-3xl border border-border bg-surface shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-ink-muted" />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            From your groups
          </span>
          <span className="text-[11px] tabular-nums text-ink-muted/70">
            · {items.length} open
          </span>
        </div>
        <button
          type="button"
          onClick={onBrowseAll}
          className="text-[11px] font-medium text-ink-muted transition hover:text-ink"
        >
          Browse all →
        </button>
      </div>

      {items.length === 1 ? (
        <div className="flex justify-center px-4 py-3">
          <StripItem item={items[0]} />
        </div>
      ) : (
        <div
          className="group relative overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
          }}
        >
          <div
            className="flex w-max items-stretch gap-3 py-3 pl-4 group-hover:[animation-play-state:paused] motion-reduce:animation-none"
            style={{ animation: "groups-join-strip 90s linear infinite" }}
          >
            {loop.map((item, i) => (
              <StripItem key={`${item.kind}-${item.id}-${i}`} item={item} />
            ))}
          </div>
          <style>{`
            @keyframes groups-join-strip {
              from { transform: translate3d(0, 0, 0); }
              to   { transform: translate3d(-50%, 0, 0); }
            }
          `}</style>
        </div>
      )}
    </section>
  );
}

function StripItem({ item }: { item: MyGroupsFeedItem }) {
  const Icon = item.kind === "collab" ? Megaphone : Radio;
  const kindLabel = item.kind === "collab" ? "Collab" : "Lounge";
  const accent = item.group.accent_color ?? "var(--ink)";
  const href =
    item.kind === "collab"
      ? { to: "/collab/$slug" as const, params: { slug: item.slug } }
      : { to: "/workshops/$slug" as const, params: { slug: item.slug } };
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const startsLabel =
    item.kind === "workshop" && startsAt
      ? startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : null;

  return (
    <Link
      {...href}
      className="group/item inline-flex h-9 max-w-[320px] shrink-0 items-center gap-2.5 rounded-full border border-border bg-background px-3 text-sm leading-none transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-soft"
    >
      <span
        aria-hidden
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-background"
        style={{ backgroundColor: accent }}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <span className="hidden shrink-0 items-center text-[10px] font-semibold uppercase leading-none tracking-wide text-ink-muted sm:inline-flex">
        {kindLabel}
      </span>
      <span className="truncate font-display text-[13px] leading-none text-ink">{item.title}</span>
      <span className="hidden shrink-0 items-center text-[11px] leading-none text-ink-muted md:inline-flex">
        · {item.group.name}
      </span>
      {startsLabel && (
        <span className="hidden shrink-0 items-center text-[11px] leading-none text-ink-muted lg:inline-flex">
          · {startsLabel}
        </span>
      )}
      <ArrowRight className="h-3 w-3 shrink-0 text-ink-muted transition group-hover/item:translate-x-0.5 group-hover/item:text-ink" />
    </Link>
  );
}
