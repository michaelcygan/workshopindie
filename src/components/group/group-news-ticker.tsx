import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Newspaper } from "lucide-react";
import { fetchGroupNews } from "@/lib/group-news.functions";

/**
 * Horizontal marquee of headlines pulled from the group's configured
 * RSS/Atom feed. Renders nothing when no URL is set or the feed is empty,
 * so groups without a feed see no chrome.
 *
 * `prefers-reduced-motion` falls back to a static horizontally-scrollable
 * strip with no animation.
 */
export function GroupNewsTicker({ groupId }: { groupId: string }) {
  const fetchNews = useServerFn(fetchGroupNews);
  const { data } = useQuery({
    queryKey: ["group", groupId, "news"],
    queryFn: () => fetchNews({ data: { group_id: groupId, limit: 12 } }),
    staleTime: 30 * 60 * 1000,
  });
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  // Duplicate the list once so the marquee can loop seamlessly.
  const loop = [...items, ...items];

  return (
    <div className="group/ticker relative mt-2 overflow-hidden border-y border-border bg-surface/60">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />

      <div className="flex items-center gap-3 px-4 py-2 motion-reduce:overflow-x-auto motion-reduce:[scrollbar-width:none]">
        <Newspaper
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-ink-muted"
        />
        <div
          className="flex shrink-0 animate-[ticker_60s_linear_infinite] items-center gap-6 whitespace-nowrap text-xs text-ink-muted group-hover/ticker:[animation-play-state:paused] motion-reduce:animate-none"
          style={{ animationName: "ticker" }}
        >
          {loop.map((n, i) => (
            <a
              key={`${i}-${n.link}`}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer ugc"
              className="shrink-0 text-ink hover:underline"
            >
              {n.title}
              <span aria-hidden className="ml-6 text-ink-muted/70">·</span>
            </a>
          ))}
        </div>
      </div>

      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
