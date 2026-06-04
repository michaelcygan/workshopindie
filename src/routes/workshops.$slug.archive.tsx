import { createFileRoute, Link } from "@tanstack/react-router";
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
  const daysLeft = archiveAt
    ? Math.max(0, Math.ceil((archiveAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/workshops/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Workshop
      </Link>

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
            {daysLeft !== null && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 p-4 text-sm text-ink">
                <Clock className="h-4 w-4 text-ink-muted" />
                Studio clears in <span className="font-medium">{daysLeft}</span> day
                {daysLeft === 1 ? "" : "s"}. Generate an archive now to keep everything.
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
