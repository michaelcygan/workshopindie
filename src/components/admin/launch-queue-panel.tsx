import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  cancelQueued,
  enqueueLaunch,
  launchQueued,
  listLaunchQueue,
  runCityLaunchBatch,
  type BatchCityResult,
} from "@/lib/geo/admin.functions";
import { LocalitySearch } from "@/components/admin/locality-search";
import { Button } from "@/components/ui/button";

export function LaunchQueuePanel() {
  const qc = useQueryClient();
  const list = useServerFn(listLaunchQueue);
  const enqueue = useServerFn(enqueueLaunch);
  const launch = useServerFn(launchQueued);
  const cancel = useServerFn(cancelQueued);
  const runBatch = useServerFn(runCityLaunchBatch);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchCityResult[]>([]);
  const [batchNote, setBatchNote] = useState<string | null>(null);


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

  async function startBatch() {
    if (batchRunning) return;
    setBatchRunning(true);
    setBatchResults([]);
    setBatchNote(null);
    try {
      let cursor = 0;
      let created = 0;
      const all: BatchCityResult[] = [];
      // Each call handles a small chunk so provider requests stay paced.
      for (let i = 0; i < 20; i += 1) {
        const res = await runBatch({ data: { cursor, createdSoFar: created } });
        cursor = res.cursor;
        created = res.created;
        all.push(...res.results);
        setBatchResults([...all]);
        if (res.done) {
          setBatchNote(
            res.stopped
              ? (res.stopReason ?? "Stopped early.")
              : `Done — ${created} manifest cities launched.`,
          );
          break;
        }
      }
      invalidate();
      toast.success("Batch launch finished");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchRunning(false);
    }
  }

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

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink">Midwest expansion batch</div>
            <p className="text-xs text-ink-muted">
              Launches the 25-city Midwest-first manifest through the same flow as a single launch.
              Safe to run twice — already-launched cities are reported, not recreated.
            </p>
          </div>
          <Button size="sm" onClick={startBatch} disabled={batchRunning}>
            {batchRunning ? "Launching…" : "Run batch"}
          </Button>
        </div>
        {batchNote ? <div className="text-xs text-ink-soft">{batchNote}</div> : null}
        {batchResults.length > 0 ? (
          <ul className="max-h-72 space-y-1 overflow-auto text-xs">
            {batchResults.map((r, i) => (
              <li key={`${r.requested}-${i}`} className="flex justify-between gap-3">
                <span className="text-ink">
                  {r.requested}, {r.state}
                  {r.citySlug ? <span className="text-ink-muted"> /{r.citySlug}</span> : null}
                </span>
                <span className="text-ink-muted">
                  {r.created ? "created" : r.queueStatus === "launched" ? "existing" : r.note}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
