import { ArrowDown, Lightbulb, Plus, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useUserRoles } from "@/hooks/use-user-role";

type Props = {
  totalGroups: number;
  cityCount: number;
  microCount: number;
  onBrowseAll: () => void;
};

/**
 * Sibling card to GroupsTrendingList — sized to its content, balances the
 * left column visually while converting dead space into an explicit
 * invitation: what Groups are, the shape of the catalog, and where to go next.
 */
export function GroupsSparkCard({ totalGroups, cityCount, microCount, onBrowseAll }: Props) {
  const { isAdmin } = useUserRoles();
  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Sparkles className="h-3.5 w-3.5 text-ink-muted" />
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          What's a Group?
        </h3>
      </div>

      <p className="px-1 font-display text-[15px] leading-snug text-ink">
        The rooms your work belongs in. Scenes, cities, sprints — find the one that
        pulls you in.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat value={totalGroups} label="rooms open" />
        <Stat value={cityCount} label="cities" />
        <Stat value={microCount} label="micro-sprints" />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {isAdmin ? (
          <Link
            to="/admin/groups"
            className="inline-flex items-center justify-between gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Start a Group
            </span>
            <span className="text-[11px] opacity-70">admin</span>
          </Link>
        ) : (
          <a
            href="mailto:hello@workshopindie.com?subject=Group%20suggestion"
            className="inline-flex items-center justify-between gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            <span className="inline-flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Suggest a scene
            </span>
            <span className="text-[11px] opacity-70">we read every one</span>
          </a>
        )}
        <button
          type="button"
          onClick={onBrowseAll}
          className="inline-flex items-center justify-between gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink-soft transition hover:bg-muted hover:text-ink"
        >
          <span>Browse all groups</span>
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-2.5 py-2 text-center">
      <div className="font-display text-lg leading-none text-ink">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
