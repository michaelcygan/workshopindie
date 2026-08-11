import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ExternalLink } from "lucide-react";

type NewsItem = {
  title: string;
  link: string;
  published_at: string | null;
  /** Present only in aggregate (multi-group) mode. */
  groupName?: string;
  groupSlug?: string;
};

type Props =
  /** Single group — the original group-page usage, unchanged. */
  | { slug: string; slugs?: never; label?: string }
  /** Several groups aggregated — the logged-in homepage. */
  | { slugs: string[]; slug?: never; label?: string };

/**
 * Group news rail — a contained pill that sits between the hero and the
 * tab bar, aligned to the same max-w-7xl container as the rest of the page.
 * Anchored label chip on the left; headlines scroll calmly through
 * the remaining space. Returns null when no feed or no items.
 *
 * Backed by the public JSON endpoints `/api/public/group-news/$slug` (one
 * group) and `/api/public/group-news-multi?slugs=` (several), so responses are
 * CDN-cacheable and independent of the server-fn RPC transport.
 */
export function GroupNewsTicker({ slug, slugs, label = "In the news" }: Props) {
  const multi = !slug;
  const keySlugs = multi ? [...(slugs ?? [])].sort() : [slug];
  const { data } = useQuery({
    queryKey: ["group-news", multi ? "multi" : "single", keySlugs.join(",")],
    enabled: keySlugs.length > 0,
    queryFn: async (): Promise<{ items: NewsItem[] }> => {
      const url = multi
        ? `/api/public/group-news-multi?slugs=${encodeURIComponent(keySlugs.join(","))}`
        : `/api/public/group-news/${encodeURIComponent(keySlugs[0]!)}`;
      const res = await fetch(url);
      if (!res.ok) {
        // Surface real backend failures to React Query (and devtools) instead of
        // silently rendering as "this group has no news".
        throw new Error(`Group news request failed: ${res.status}`);
      }
      return (await res.json()) as { items: NewsItem[] };
    },
    retry: 1,
    staleTime: 30 * 60 * 1000,
  });
  const items = data?.items ?? [];
  const [hovering, setHovering] = useState(false);
  const [open, setOpen] = useState(false);
  if (keySlugs.length === 0) return null;
  if (items.length === 0) return null;
  const paused = hovering;

  const durationSec = Math.max(180, items.length * 28);
  const loop = [...items, ...items];

  return (
    <div className="px-4 md:px-6">
      <div
        className="gnt-pill relative isolate flex h-9 items-stretch overflow-hidden rounded-full border border-border bg-surface/70 backdrop-blur-sm sm:h-10"
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
                {label}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={8}
            avoidCollisions={false}
            className="w-[min(92vw,28rem)] max-h-[70vh] overflow-y-auto p-0"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                  {label}
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
                    <span className="min-w-0 flex-1 leading-snug">
                      {n.groupName && (
                        <span className="mr-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
                          {n.groupName}
                        </span>
                      )}
                      <span className="line-clamp-3">{n.title}</span>
                    </span>
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
                  {n.groupName && (
                    <span className="mr-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
                      {n.groupName}
                    </span>
                  )}
                  {n.title}
                </a>
              </li>
            ))}
          </ul>

          {/* Marquee */}
          <div
            className="gnt-marquee flex h-full items-center gap-5 whitespace-nowrap pl-3 text-[12px] sm:pl-4 sm:text-[13px] text-ink will-change-transform motion-reduce:hidden"
            data-paused={paused ? "true" : "false"}
            style={{
              animation: `gnt-scroll ${durationSec}s linear infinite`,
              width: "max-content",
            }}
          >
            {loop.map((n, i) => (
              <span key={`${i}-${n.link}`} className="shrink-0">
                {n.groupSlug && n.groupName && (
                  <>
                    <Link
                      to="/g/$slug"
                      params={{ slug: n.groupSlug }}
                      className="text-[11px] uppercase tracking-wider text-ink-muted hover:text-ink"
                    >
                      {n.groupName}
                    </Link>
                    <span aria-hidden className="mx-1.5 text-ink-muted/50">·</span>
                  </>
                )}
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer ugc"
                  className="hover:underline focus:outline-none focus-visible:underline"
                >
                  {n.title}
                </a>
                <span aria-hidden className="ml-5 text-ink-muted/40">•</span>
              </span>
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
