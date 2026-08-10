import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { fieldLabel } from "@/lib/taxonomy";
import {
  adminListPodcastApplications,
  adminUpdatePodcastApplication,
  PODCAST_STATUSES,
  PODCAST_STATUS_LABELS,
  type PodcastApplication,
  type PodcastStatus,
} from "@/lib/podcast.functions";

export const Route = createFileRoute("/admin/podcast")({
  component: AdminPodcastPage,
  head: () => ({ meta: [{ title: "Podcast applications — Admin" }] }),
});

function StatusBadge({ status }: { status: PodcastStatus }) {
  const tone =
    status === "new"
      ? "bg-primary/10 text-primary"
      : status === "declined" || status === "archived"
        ? "bg-muted text-ink-muted"
        : "bg-ink/10 text-ink";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {PODCAST_STATUS_LABELS[status]}
    </span>
  );
}

function AdminPodcastPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPodcastApplications);
  const updateFn = useServerFn(adminUpdatePodcastApplication);
  const [filter, setFilter] = useState<PodcastStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "podcast-applications"],
    queryFn: () => listFn(),
  });

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => !filter || r.status === filter),
    [data, filter],
  );
  const selected: PodcastApplication | null =
    (data?.rows ?? []).find((r) => r.id === openId) ?? null;

  const update = useMutation({
    mutationFn: (input: { id: string; status?: PodcastStatus; internalNotes?: string | null }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "podcast-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = data?.counts ?? {};
  const stats = [
    { label: "Total", value: data?.total ?? 0 },
    { label: "New", value: counts["new"] ?? 0 },
    { label: "Shortlisted", value: counts["shortlisted"] ?? 0 },
    { label: "Invited", value: counts["invited"] ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-ink">Podcast applications</h2>
        <p className="text-sm text-ink-muted">Workshop Independent guest funnel.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-sm ${
            filter === null ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
          }`}
        >
          All
        </button>
        {PODCAST_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {PODCAST_STATUS_LABELS[s]} {counts[s] ? `· ${counts[s]}` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td className="px-4 py-6 text-ink-muted" colSpan={5}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-4 py-6 text-ink-muted" colSpan={5}>No applications yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border hover:bg-muted/50"
                  onClick={() => {
                    setOpenId(r.id);
                    setNotes(r.internal_notes ?? "");
                  }}
                >
                  <td className="px-4 py-3 text-ink">{r.name}</td>
                  <td className="px-4 py-3 text-ink-muted">{fieldLabel(r.field)}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.city || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl text-ink">{selected.name}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-ink-muted">{fieldLabel(selected.field)}</span>
                  {selected.specialization && (
                    <span className="text-ink-muted">· {selected.specialization}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink">{selected.email}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md"
                      onClick={() => {
                        navigator.clipboard.writeText(selected.email);
                        toast.success("Email copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </Button>
                  </div>
                  <a
                    href={selected.portfolio_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    {selected.portfolio_url} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {selected.social_handle && (
                    <p className="text-ink-muted">Social: {selected.social_handle}</p>
                  )}
                  {selected.workshop_username && (
                    <a
                      href={`/${selected.workshop_username}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      @{selected.workshop_username} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {selected.city && <p className="text-ink-muted">{selected.city}</p>}
                  <p className="text-ink-muted">
                    Marketing opt-in: {selected.marketing_opt_in ? "Yes" : "No"}
                  </p>
                  <p className="text-ink-muted">
                    Asked to create an account: {selected.wants_account ? "Yes" : "No"}
                  </p>

                  {selected.user_id && (
                    <p className="text-ink-muted">
                      Workshop account:{" "}
                      {data?.usernames?.[selected.user_id]
                        ? `@${data.usernames[selected.user_id]}`
                        : "linked"}
                    </p>
                  )}
                  <p className="text-ink-muted">
                    Submitted {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>

                <Section title="Process">{selected.process_description}</Section>
                {selected.current_work && (
                  <Section title="Working on now">{selected.current_work}</Section>
                )}
                {selected.conversation_topics && (
                  <Section title="Would enjoy talking about">
                    {selected.conversation_topics}
                  </Section>
                )}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-ink-muted">Status</p>
                  <Select
                    value={selected.status}
                    onValueChange={(v) =>
                      update.mutate({ id: selected.id, status: v as PodcastStatus })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PODCAST_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{PODCAST_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-ink-muted">Internal notes</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    maxLength={4000}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        update.mutate(
                          { id: selected.id, internalNotes: notes },
                          { onSuccess: () => toast.success("Notes saved") },
                        )
                      }
                    >
                      Save notes
                    </Button>
                    {selected.status !== "archived" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update.mutate({ id: selected.id, status: "archived" })}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-muted">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink-soft">{children}</p>
    </div>
  );
}
