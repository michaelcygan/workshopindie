import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchGroupNews } from "@/lib/group-news.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink } from "lucide-react";


/**
 * Group news rail — a contained pill that sits between the hero and the
 * tab bar, aligned to the same max-w-7xl container as the rest of the page.
 * Anchored "In the news" chip on the left; headlines scroll calmly through
 * the remaining space. Returns null when no feed or no items.
 */
export function GroupNewsTicker({ groupId }: { groupId: string }) {
  const fetchNews = useServerFn(fetchGroupNews);
  const { data } = useQuery({
    queryKey: ["group", groupId, "news"],
    queryFn: () => fetchNews({ data: { group_id: groupId, limit: 12 } }),
    staleTime: 30 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const [hovering, setHovering] = useState(false);
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const paused = hovering || open;

  const durationSec = Math.max(90, items.length * 14);
  const loop = [...items, ...items];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div
        className="gnt-pill relative isolate flex h-10 items-stretch overflow-hidden rounded-full border border-border bg-surface/70 backdrop-blur-sm"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Anchored label — click to open headlines drawer */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative z-20 flex shrink-0 items-center gap-2 rounded-l-full bg-surface px-3 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:pr-4"
              aria-label="Open headlines"
            >
              <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="hidden text-[11px] font-medium uppercase tracking-wider text-ink-muted sm:inline">
                In the news
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={8}
            className="w-[min(92vw,28rem)] max-h-[70vh] overflow-y-auto p-0"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  In the news
                </span>
              </div>
              <span className="text-[11px] text-ink-muted">{items.length}</span>
            </div>
            <ul className="divide-y divide-border">
              {items.slice(0, 15).map((n, i) => (
                <li key={`d-${i}-${n.link}`}>
                  <a
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer ugc"
                    className="group flex items-start gap-3 px-4 py-3 text-sm text-ink hover:bg-muted/60"
                  >
                    <span className="line-clamp-3 flex-1 leading-snug">{n.title}</span>
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 transition group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>

        <div aria-hidden className="my-2 w-px shrink-0 bg-border/80" />

        {/* Rail */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-surface/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-surface/80 to-transparent" />

          {/* Reduced-motion fallback */}
          <ul className="hidden h-full items-center gap-10 px-4 text-[13px] text-ink motion-reduce:flex">
            {items.slice(0, 3).map((n, i) => (
              <li key={`s-${i}`} className="truncate">
                <a href={n.link} target="_blank" rel="noopener noreferrer ugc" className="hover:underline">
                  {n.title}
                </a>
              </li>
            ))}
          </ul>

          {/* Marquee */}
          <div
            className="gnt-marquee flex h-full items-center gap-10 whitespace-nowrap pl-4 text-[13px] text-ink will-change-transform motion-reduce:hidden"
            data-paused={paused ? "true" : "false"}
            style={{
              animation: `gnt-scroll ${durationSec}s linear infinite`,
              width: "max-content",
            }}
          >
            {loop.map((n, i) => (
              <a
                key={`${i}-${n.link}`}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer ugc"
                className="shrink-0 hover:underline focus:outline-none focus-visible:underline"
              >
                {n.title}
                <span aria-hidden className="ml-10 text-ink-muted/40">•</span>
              </a>
            ))}
          </div>
        </div>

        <style>{`
          @keyframes gnt-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .gnt-marquee[data-paused="true"] { animation-play-state: paused !important; }
        `}</style>
      </div>

    </div>
  );
}
