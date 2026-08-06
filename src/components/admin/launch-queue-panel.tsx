import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelQueued, enqueueLaunch, launchQueued, listLaunchQueue } from "@/lib/geo/admin.functions";
import { LocalitySearch } from "@/components/admin/locality-search";
import { Button } from "@/components/ui/button";

export function LaunchQueuePanel() {
  const qc = useQueryClient();
  const list = useServerFn(listLaunchQueue);
  const enqueue = useServerFn(enqueueLaunch);
  const launch = useServerFn(launchQueued);
  const cancel = useServerFn(cancelQueued);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "launch-queue"],
    queryFn: () => list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "launch-queue"] });
    qc.invalidateQueries({ queryKey: ["admin", "localities"] });
  };

  const enqueueMut = useMutation({
    mutationFn: (vars: { providerId: string; launchNow?: boolean }) => enqueue({ data: vars }),
    onSuccess: (res) => {
      toast.success(res.launched ? "Locality launched" : "Added to the launch queue");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const launchMut = useMutation({
    mutationFn: (id: string) => launch({ data: { id } }),
    onSuccess: () => {
      toast.success("Locality launched");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancel({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed from the queue");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.queue ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm text-ink">Pre-seed a scene</div>
        <p className="text-xs text-ink-muted">
          Search anywhere in the world. Picking a place queues it; launch it to create the locality and its
          official city Group before anyone arrives.
        </p>
        <LocalitySearch
          mode="new"
          placeholder="Search a city or town to launch…"
          onPick={(o) => {
            if (!o.providerId) return;
            enqueueMut.mutate({ providerId: o.providerId, launchNow: true });
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Place</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-ink-muted">
                  Nothing queued yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">{r.displayName}</td>
                  <td className="px-3 py-2">
                    <span className="text-xs uppercase tracking-wide text-ink-soft">{r.status}</span>
                    {r.error ? <div className="text-xs text-red-500">{r.error}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {r.status !== "launched" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={launchMut.isPending}
                          onClick={() => launchMut.mutate(r.id)}
                        >
                          {r.status === "failed" ? "Retry" : "Launch"}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => cancelMut.mutate(r.id)}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
