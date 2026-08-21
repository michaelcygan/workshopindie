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
import { Copy, ExternalLink, MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  adminListOpenHouseApplications,
  adminUpdateOpenHouseApplication,
  adminMessageOpenHouseApplicant,
} from "@/lib/open-house-applications.functions";
import {
  OPEN_HOUSE_STATUSES,
  OPEN_HOUSE_STATUS_LABELS,
  PARTNER_TYPES,
  applicationTypeLabel,
  lengthLabel,
  type OpenHouseApplication,
  type OpenHouseStatus,
} from "@/lib/open-house";

export const Route = createFileRoute("/admin/open-house")({
  component: AdminOpenHousePage,
  head: () => ({ meta: [{ title: "Open House applications — Admin" }] }),
});

function StatusBadge({ status }: { status: OpenHouseStatus }) {
  const tone =
    status === "new"
      ? "bg-primary/10 text-primary"
      : status === "declined" || status === "archived"
        ? "bg-muted text-ink-muted"
        : "bg-ink/10 text-ink";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${tone}`}>
      {OPEN_HOUSE_STATUS_LABELS[status]}
    </span>
  );
}

function AdminOpenHousePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(adminListOpenHouseApplications);
  const updateFn = useServerFn(adminUpdateOpenHouseApplication);
  const messageFn = useServerFn(adminMessageOpenHouseApplicant);
  const [filter, setFilter] = useState<OpenHouseStatus | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "open-house-applications"],
    queryFn: () => listFn(),
  });

  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) =>
          (!filter || r.status === filter) &&
          (typeFilter === "all" || (r.partner_type || r.program_type) === typeFilter),
      ),
    [data, filter, typeFilter],
  );
  const selected: OpenHouseApplication | null =
    (data?.rows ?? []).find((r) => r.id === openId) ?? null;

  const update = useMutation({
    mutationFn: (input: {
      id: string;
      status?: OpenHouseStatus;
      internalNotes?: string | null;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "open-house-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const message = useMutation({
    mutationFn: (id: string) => messageFn({ data: { id } }),
    onSuccess: (res) => {
      const id = (res as { conversationId?: string })?.conversationId;
      if (id) navigate({ to: "/dms/$conversationId", params: { conversationId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = data?.counts ?? {};
  const stats = [
    { label: "Total", value: data?.total ?? 0 },
    { label: "New", value: counts["new"] ?? 0 },
    { label: "Shortlisted", value: counts["shortlisted"] ?? 0 },
    { label: "Booked", value: counts["booked"] ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-ink">Open House applications</h2>
          <p className="text-sm text-ink-muted">
            People interested in performing or presenting at a future Workshop Open House.
          </p>
        </div>
        <a
          href="/applyopenhouse"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Open application page <ExternalLink className="h-3.5 w-3.5" />
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

      <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-full px-3 py-1 text-sm ${
            filter === null ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
          }`}
        >
          All
        </button>
        {OPEN_HOUSE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === s ? "bg-background font-medium text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {OPEN_HOUSE_STATUS_LABELS[s]} {counts[s] ? `· ${counts[s]}` : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-ink-muted">Partner type</span>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {PARTNER_TYPES.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-ink-muted" colSpan={5}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-ink-muted" colSpan={5}>
                  No applications yet.
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
                    <span className="block text-ink">{r.project_name || r.contact_name}</span>
                    {r.project_name && (
                      <span className="block text-xs text-ink-muted">{r.contact_name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{programTypeLabel(r.program_type)}</td>
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
                  {selected.project_name || selected.contact_name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-ink-muted">
                    {programTypeLabel(selected.program_type)}
                  </span>
                  {selected.approximate_length && (
                    <span className="text-ink-muted">
                      · {lengthLabel(selected.approximate_length)}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {selected.project_name && (
                    <p className="text-ink-muted">Contact: {selected.contact_name}</p>
                  )}
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

                <Section title="Proposal">{selected.proposal}</Section>
                {selected.setup_needs && (
                  <Section title="Setup needs">{selected.setup_needs}</Section>
                )}

                <p className="rounded-xl border border-border bg-muted/50 p-3 text-xs leading-relaxed text-ink-muted">
                  Before scheduling, confirm that the venue permits the proposed activity. A
                  canonical Workshop venue record does not itself authorize a performance or
                  programmed event.
                </p>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-ink-muted">Status</p>
                  <Select
                    value={selected.status}
                    onValueChange={(v) =>
                      update.mutate({ id: selected.id, status: v as OpenHouseStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPEN_HOUSE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {OPEN_HOUSE_STATUS_LABELS[s]}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-muted">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-ink-soft">{children}</p>
    </div>
  );
}
