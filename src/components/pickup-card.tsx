import { Link } from "@tanstack/react-router";
import { ListChecks, ArrowRight, Clock, Hammer } from "lucide-react";
import { useInProgressBadge } from "@/hooks/use-in-progress-badge";

/**
 * Signed-in homepage entry to /in-progress. Renders nothing when:
 *  - user is signed out (badge hook is disabled)
 *  - the bundle is empty (nothing to pick up)
 *
 * Surfaces the top task + top workshop with one CTA each. Reuses the
 * `useInProgressBadge` query so it shares a cache key with the avatar dot.
 */
export function PickupCard() {
  const { bundle, enabled } = useInProgressBadge();
  if (!enabled || !bundle) return null;

  const topTask = bundle.tasks[0] ?? null;
  const topWorkshop = bundle.workshops[0] ?? null;
  if (!topTask && !topWorkshop) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 md:px-6 md:pt-8">
      <div className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-4 md:p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListChecks className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base text-ink md:text-lg">Pick up where you left off</h2>
              <p className="text-[11px] text-ink-muted">From your dashboard</p>
            </div>
          </div>
          <Link
            to="/in-progress"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft hover:bg-muted transition"
          >
            See all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {topTask && (
            <Link
              to="/workshops/$slug"
              params={{ slug: topTask.workshop_slug }}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
                <Clock className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-ink-muted">Task · {topTask.workshop_title}</div>
                <div className="line-clamp-1 text-sm font-medium text-ink">{topTask.title}</div>
                {topTask.due_by && (
                  <div className="text-[11px] text-ink-muted">
                    Due {new Date(topTask.due_by).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                )}
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          )}
          {topWorkshop && (
            <Link
              to="/workshops/$slug"
              params={{ slug: topWorkshop.slug }}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-ink-soft">
                <Hammer className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wide text-ink-muted">Workshop · {topWorkshop.status}</div>
                <div className="line-clamp-1 text-sm font-medium text-ink">{topWorkshop.title}</div>
                <div className="text-[11px] text-ink-muted">
                  Last activity {new Date(topWorkshop.last_activity_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
