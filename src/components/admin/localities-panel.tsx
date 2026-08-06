import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listLocalities,
  mergeLocality,
  reviewLocality,
  type AdminLocality,
} from "@/lib/geo/admin.functions";
import { LocalitySearch } from "@/components/admin/locality-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_FILTERS = ["all", "active", "paused", "deactivated", "merged"] as const;

function StatusChip({ status, needsReview }: { status: string; needsReview: boolean }) {
  const tone =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "merged"
        ? "bg-muted text-ink-muted"
        : "bg-amber-500/10 text-amber-600";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>{status}</span>
      {needsReview ? (
        <span className="rounded-full bg-[#3157E0]/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#3157E0]">
          review
        </span>
      ) : null}
    </span>
  );
}

export function LocalitiesPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listLocalities);
  const review = useServerFn(reviewLocality);
  const merge = useServerFn(mergeLocality);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [needsReview, setNeedsReview] = useState(false);
  const [memberAdded, setMemberAdded] = useState(false);
  const [mergeSource, setMergeSource] = useState<AdminLocality | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "localities", q, status, needsReview, memberAdded],
    queryFn: () => list({ data: { q, status, needsReview, memberAdded, limit: 100 } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "localities"] });

  const reviewMut = useMutation({
    mutationFn: (vars: { cityId: string; action: "approve" | "pause" | "deactivate" | "reactivate" }) =>
      review({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Locality ${vars.action}d`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeMut = useMutation({
    mutationFn: (vars: { sourceId: string; targetId: string }) => merge({ data: vars }),
    onSuccess: (res) => {
      const moved = Object.values(res.moved ?? {}).reduce((a, b) => a + (b || 0), 0);
      toast.success(`Merged — ${moved} record${moved === 1 ? "" : "s"} moved`);
      setMergeSource(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.localities ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search localities…"
          className="w-56"
        />
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${
                status === s ? "border-ink bg-ink text-surface" : "border-border text-ink-soft"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} />
          Needs review
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input type="checkbox" checked={memberAdded} onChange={(e) => setMemberAdded(e.target.checked)} />
          Member-added
        </label>
      </div>

      {mergeSource ? (
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm text-ink">
            Merge <strong>{mergeSource.name}</strong> into…
          </div>
          <p className="text-xs text-ink-muted">
            Everyone and everything attached to {mergeSource.name} moves to the target. This can’t be undone.
          </p>
          <LocalitySearch
            mode="existing"
            placeholder="Search the canonical locality…"
            onPick={(o) => {
              if (!o.cityId || o.cityId === mergeSource.id) return;
              mergeMut.mutate({ sourceId: mergeSource.id, targetId: o.cityId });
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => setMergeSource(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">Locality</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-left">Added by</th>
              <th className="px-3 py-2 text-right">Members</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-muted">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-muted">
                  No localities match those filters.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t border-border align-middle">
                  <td className="px-3 py-2">
                    <div className="text-ink">{c.name}</div>
                    <div className="text-xs text-ink-muted">
                      {c.sublabel}
                      {c.officialGroupSlug ? ` · /g/${c.officialGroupSlug}` : " · no official group"}
                      {c.mergedIntoName ? ` · → ${c.mergedIntoName}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip status={c.status} needsReview={c.needsReview} />
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-soft">
                    {c.addedBy ?? "—"}
                    <div className="text-ink-muted">{c.source ?? ""}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-soft">{c.members}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1">
                      {c.status !== "merged" ? (
                        <>
                          {c.needsReview ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewMut.mutate({ cityId: c.id, action: "approve" })}
                            >
                              Approve
                            </Button>
                          ) : null}
                          {c.status === "active" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reviewMut.mutate({ cityId: c.id, action: "deactivate" })}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => reviewMut.mutate({ cityId: c.id, action: "reactivate" })}
                            >
                              Reactivate
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setMergeSource(c)}>
                            Merge…
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-ink-muted">merged</span>
                      )}
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
