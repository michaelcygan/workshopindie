import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { getWorksBySource } from "@/lib/work-provenance.functions";

type Props =
  | { workshopId: string; collabPostId?: never; excludeWorkId?: string | null; title?: string }
  | { collabPostId: string; workshopId?: never; excludeWorkId?: string | null; title?: string };

/**
 * Reverse-provenance rail: lists public Works born from a Workshop or Collab.
 *
 * Renders nothing when no public Works exist yet — pages stay clean instead of
 * filling with a "no works yet" void. The `excludeWorkId` prop lets a caller
 * hide a Work that's already featured elsewhere on the page (e.g. the
 * canonical shipped Work in `ShippedBanner`).
 */
export function WorksBornHere(props: Props) {
  const fn = useServerFn(getWorksBySource);
  const key = "workshopId" in props && props.workshopId
    ? ["works-by-source", "workshop", props.workshopId]
    : ["works-by-source", "collab", (props as { collabPostId: string }).collabPostId];

  const { data: works = [] } = useQuery({
    queryKey: key,
    staleTime: 60_000,
    queryFn: () =>
      fn({
        data: {
          workshop_id: "workshopId" in props ? props.workshopId : undefined,
          collab_post_id: "collabPostId" in props ? props.collabPostId : undefined,
          limit: 12,
        },
      }),
  });

  const visible = props.excludeWorkId ? works.filter((w) => w.id !== props.excludeWorkId) : works;
  if (visible.length === 0) return null;

  const heading = props.title ?? (visible.length === 1 ? "Born here" : "Born here");

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="font-display text-lg text-ink">{heading}</h2>
          <span className="text-[11px] text-ink-muted">{visible.length}</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((w) => (
          <Link
            key={w.id}
            to="/works/$slug"
            params={{ slug: w.slug }}
            className="group flex gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            {w.cover_url ? (
              <img
                src={w.cover_url}
                alt=""
                loading="lazy"
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted text-ink-muted">
                <Sparkles className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-medium text-ink">{w.title}</div>
              {w.excerpt && (
                <div className="line-clamp-2 text-xs text-ink-muted">{w.excerpt}</div>
              )}
              {w.author && (
                <div className="mt-1 truncate text-[11px] text-ink-muted">
                  by {w.author.display_name || w.author.username || "a maker"}
                </div>
              )}
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </section>
  );
}
