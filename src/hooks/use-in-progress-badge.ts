import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getInProgress, type InProgressBundle } from "@/lib/in-progress.functions";

const DAY = 86_400_000;

/**
 * Shared "In Progress" badge for top-nav avatar and mobile You tab.
 * Counts open tasks due within 7d (or already overdue) + workshops
 * starting within 14d. Hidden when zero. Falls back to silent zero on
 * any failure — never blocks the nav.
 *
 * Also returns the full bundle so the homepage "Pick up where you left off"
 * card can share the same cache.
 */
export function useInProgressBadge() {
  const { user } = useAuth();
  const fn = useServerFn(getInProgress);

  const query = useQuery({
    queryKey: ["in-progress", user?.id ?? null],
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: () => fn({ data: {} }),
  });

  const bundle: InProgressBundle | undefined = query.data;
  const now = Date.now();

  const dueTasks =
    bundle?.tasks.filter((t) => {
      if (!t.due_by) return false;
      const dt = new Date(t.due_by).getTime();
      return dt - now <= 7 * DAY; // overdue OR due within 7d
    }).length ?? 0;

  const upcomingWorkshops =
    bundle?.workshops.filter((w) => {
      // Workshops with no explicit ends_at still count if active-ish.
      if (!w.ends_at) return true;
      const dt = new Date(w.ends_at).getTime();
      return dt - now <= 14 * DAY && dt >= now - DAY;
    }).length ?? 0;

  const count = dueTasks + upcomingWorkshops;

  return {
    count,
    bundle,
    isLoading: query.isLoading,
    enabled: !!user,
  };
}
