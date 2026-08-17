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
import {
  adminListFilmFestivalSubmissions,
  adminUpdateFilmFestivalSubmission,
} from "@/lib/film-festival.functions";
import {
  FILM_STATUSES,
  FILM_STATUS_LABELS,
  filmFormatLabel,
  type FilmFestivalSubmission,
  type FilmStatus,
} from "@/lib/film-festival";

export const Route = createFileRoute("/admin/film-festival")({
  component: AdminFilmFestivalPage,
  head: () => ({ meta: [{ title: "Film Festival submissions — Admin" }] }),
});

function StatusBadge({ status }: { status: FilmStatus }) {
  const tone =
    status === "new"
      ? "bg-primary/10 text-primary"
      : status === "declined" || status === "archived"
        ? "bg-muted text-ink-muted"
        : "bg-ink/10 text-ink";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {FILM_STATUS_LABELS[status]}
    </span>
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

function AdminFilmFestivalPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListFilmFestivalSubmissions);
  const updateFn = useServerFn(adminUpdateFilmFestivalSubmission);
  const [filter, setFilter] = useState<FilmStatus | null>(null);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "film-festival-submissions"],
    queryFn: () => listFn(),
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (filter && r.status !== filter) return false;
      if (!needle) return true;
      return [r.film_title, r.contact_name, r.email, r.city]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(needle));
    });
  }, [data, filter, q]);

  const selected: FilmFestivalSubmission | null =
    (data?.rows ?? []).find((r) => r.id === openId) ?? null;

  const update = useMutation({
    mutationFn: (input: { id: string; status?: FilmStatus; internalNotes?: string | null }) =>
      updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "film-festival-submissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = data?.counts ?? {};
  const stats = [
    { label: "Total", value: data?.total ?? 0 },
    { label: "New", value: counts["new"] ?? 0 },
    { label: "Shortlisted", value: counts["shortlisted"] ?? 0 },
    { label: "Programmed", value: counts["programmed"] ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">Film Festival submissions</h2>
          <p className="text-sm text-ink-muted">
            Films submitted for future Workshop Film Festival pop-up screenings.
          </p>
        </div>
        <a
          href="/film-festival"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open submission page <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-ink-muted">{s.label}</p>
            <p className="mt-1 font-display text-2xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === null ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            All
          </button>
          {FILM_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-sm ${
                filter === s ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {FILM_STATUS_LABELS[s]} {counts[s] ? `· ${counts[s]}` : ""}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, name, email, city"
          className="h-9 min-w-[220px] flex-1 rounded-full border border-border bg-background px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">Film</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Runtime</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-ink-muted" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-muted" colSpan={6}>
                  No submissions yet.
                </td>
              </tr>
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
                  <td className="px-4 py-3">
                    <span className="block text-ink">{r.film_title}</span>
                    <span className="block text-xs text-ink-muted">{r.contact_name}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{filmFormatLabel(r.film_format)}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.runtime_minutes ? `${r.runtime_minutes} min` : "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.city || "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
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
                <SheetTitle className="font-display text-2xl text-ink">
                  {selected.film_title}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-ink-muted">{filmFormatLabel(selected.film_format)}</span>
                  {selected.runtime_minutes ? (
                  <span className="text-ink-muted">· {selected.runtime_minutes} min</span>
                ) : null}
                  {selected.completion_year && (
                    <span className="text-ink-muted">· {selected.completion_year}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-ink-muted">Contact: {selected.contact_name}</p>
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
                    href={selected.trailer_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    Trailer <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {selected.film_url && (
                    <a
                      href={selected.film_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="ml-4 inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      Full film <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {selected.access_notes && (
                    <p className="text-ink-muted">Access: {selected.access_notes}</p>
                  )}
                  {selected.workshop_username && (
                    <a
                      href={`/${selected.workshop_username}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block text-primary hover:underline"
                    >
                      @{selected.workshop_username}
                    </a>
                  )}
                  {selected.city && <p className="text-ink-muted">{selected.city}</p>}
                  <p className="text-ink-muted">
                    Screening rights confirmed: {selected.rights_confirmed ? "Yes" : "No"}
                  </p>
                  <p className="text-ink-muted">
                    Marketing opt-in: {selected.marketing_opt_in ? "Yes" : "No"}
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

                <Section title="Logline">{selected.logline}</Section>
                {selected.synopsis ? (
                  <Section title="About the film">{selected.synopsis}</Section>
                ) : null}
                {selected.credits && <Section title="Credits">{selected.credits}</Section>}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-ink-muted">Status</p>
                  <Select
                    value={selected.status}
                    onValueChange={(v) =>
                      update.mutate({ id: selected.id, status: v as FilmStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILM_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {FILM_STATUS_LABELS[s]}
                        </SelectItem>
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
