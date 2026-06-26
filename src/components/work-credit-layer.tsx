import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Hammer } from "lucide-react";
import { CreditStrip, type CreditChip } from "@/components/credit-strip";
import { getWorkProvenance } from "@/lib/work-provenance.functions";

type Props = {
  workId: string;
  credits: CreditChip[];
};

/**
 * Canonical credit surface for a Work. Combines the cast strip with
 * provenance chips (the Collab post and Workshop the work came from).
 *
 * v1 scope: collab + workshop chips only — event linkage isn't recorded on
 * the works table yet. Renders nothing if there are no credits and no
 * provenance, so it never adds noise to a bare Work.
 */
export function WorkCreditLayer({ workId, credits }: Props) {
  const fn = useServerFn(getWorkProvenance);
  const { data } = useQuery({
    queryKey: ["work-provenance", workId],
    queryFn: () => fn({ data: { work_id: workId } }),
    staleTime: 5 * 60 * 1000,
  });

  const hasCredits = credits.length > 0;
  const hasProvenance = !!(data?.collab || data?.workshop);
  if (!hasCredits && !hasProvenance) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-ink">Credits</h2>

      {hasCredits && <CreditStrip className="mt-4" credits={credits} />}

      {hasProvenance && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data?.collab && (
            <Link
              to="/collab/$slug"
              params={{ slug: data.collab.slug }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink/20 hover:text-ink hover:shadow-soft"
              title="The Open Collab this Work came from"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-ink-muted">From this Collab ·</span>
              <span className="font-medium text-ink">{data.collab.title}</span>
            </Link>
          )}
          {data?.workshop && (
            <Link
              to="/workshops/$slug"
              params={{ slug: data.workshop.slug }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink/20 hover:text-ink hover:shadow-soft"
              title="The Lounge where this was made"
            >
              <Hammer className="h-3.5 w-3.5 text-primary" />
              <span className="text-ink-muted">Born in this Workshop ·</span>
              <span className="font-medium text-ink">{data.workshop.title}</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
