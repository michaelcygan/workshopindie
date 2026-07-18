import { createFileRoute, Link } from "@tanstack/react-router";
import { useSmartBack } from "@/hooks/use-smart-back";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Package, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  generateWorkshopArchive,
  getWorkshopArchiveUrl,
} from "@/lib/workshop-archive.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/workshops/$slug/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  const { slug } = Route.useParams();
  const goBack = useSmartBack({ to: "/workshops/$slug", params: { slug } });
  const [workshopId, setWorkshopId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("workshops")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => setWorkshopId(data?.id ?? null));
  }, [slug]);

  const getUrl = useServerFn(getWorkshopArchiveUrl);
  const generate = useServerFn(generateWorkshopArchive);

  const { data, refetch } = useQuery({
    queryKey: ["workshop-archive", workshopId],
    queryFn: () => getUrl({ data: { workshopId: workshopId! } }),
    enabled: !!workshopId,
  });

  const gen = useMutation({
    mutationFn: () => generate({ data: { workshopId: workshopId! } }),
    onSuccess: (r) => {
      toast.success("Archive ready");
      if (r.signed_url) window.open(r.signed_url, "_blank");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't generate archive"),
  });

  if (!workshopId) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-14">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-2" />
      </main>
    );
  }

  const archived = !!data?.archived_at;
  const archiveAt = data?.archive_at ? new Date(data.archive_at) : null;
  const lastActivity = (data as any)?.last_activity_at
    ? new Date((data as any).last_activity_at)
    : null;
  const msLeft = archiveAt ? Math.max(0, archiveAt.getTime() - Date.now()) : null;
  const hoursLeft = msLeft !== null ? Math.ceil(msLeft / (60 * 60 * 1000)) : null;
  const daysLeft = msLeft !== null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;
  const urgent = msLeft !== null && msLeft <= 24 * 60 * 60 * 1000;
  const countdown =
    msLeft === null
      ? null
      : hoursLeft! <= 48
      ? `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`
      : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`;
  const fmtDate = (d: Date) =>
    d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const fmtRelative = (d: Date) => {
    const diff = Date.now() - d.getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Workshop
      </button>

      <div className="mt-6 rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl text-ink">Studio archive</h1>
            <p className="text-sm text-ink-muted">
              {data?.title ?? "Workshop"} — everything from the studio in one file.
            </p>
          </div>
        </div>

        {archived ? (
          <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5">
            <p className="text-sm text-ink">
              The studio has been cleared. Your archive is still available below.
            </p>
            {data?.signed_url ? (
              <Button asChild className="mt-3 rounded-full">
                <a href={data.signed_url} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Download archive
                </a>
              </Button>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No archive on file.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {archiveAt && (
              <div
                className={
                  "rounded-2xl border p-4 text-sm " +
                  (urgent
                    ? "border-destructive/40 bg-destructive/5 text-ink"
                    : "border-border bg-surface-2 text-ink")
                }
              >
                <div className="flex items-center gap-2">
                  <Clock className={"h-4 w-4 " + (urgent ? "text-destructive" : "text-ink-muted")} />
                  <span>
                    Auto-clears in <span className="font-medium">{countdown}</span>
                    <span className="text-ink-muted"> ({fmtDate(archiveAt)})</span>
                  </span>
                </div>
                {lastActivity && (
                  <p className="mt-1.5 pl-6 text-xs text-ink-muted">
                    Last activity {fmtRelative(lastActivity)}. Any new doc, task,
                    file, poll, or chat message resets the 30-day clock.
                  </p>
                )}
                <p className="mt-1 pl-6 text-[11px] text-ink-muted">
                  Reminders go out 7 days, 3 days, 24 hours, and 6 hours before clearing.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => gen.mutate()}
                disabled={gen.isPending}
                className="rounded-full"
              >
                <Package className="mr-2 h-4 w-4" />
                {gen.isPending ? "Building archive…" : "Generate archive"}
              </Button>
              {data?.has_archive && data.signed_url && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href={data.signed_url} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" /> Download latest
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              The archive is a JSON manifest including docs, tasks, drive links,
              uploaded files (with 7-day download links), polls, and member list.
              A painter doesn't bring brushes to the gallery — but you can box them up.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
