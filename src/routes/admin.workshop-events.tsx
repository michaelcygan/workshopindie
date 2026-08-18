import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getWorkshopVenue } from "@/lib/events/workshop-venues";
import type { ProgramSummary } from "@/lib/workshop-programs.functions";
import {
  cancelProgramOccurrence,
  cancelWorkshopProgramFuture,
  listWorkshopPrograms,
  setWorkshopProgramActive,
  topUpWorkshopProgram,
  updateWorkshopProgram,
} from "@/lib/workshop-programs.functions";

export const Route = createFileRoute("/admin/workshop-events")({
  component: AdminWorkshopEventsPage,
  head: () => ({
    meta: [
      { title: "Workshop Events — Admin" },
      {
        name: "description",
        content: "Control room for Workshop-created event programs and their upcoming occurrences.",
      },
    ],
  }),
});

function fmt(iso: string | null, tz: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AdminWorkshopEventsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWorkshopPrograms);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "workshop-programs"],
    queryFn: () => listFn(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-ink">Workshop Events</h2>
        <p className="text-sm text-ink-muted">
          Programs Workshop runs itself. Each occurrence is an ordinary Event — automation only
          keeps the calendar full.
        </p>
      </div>
      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading programs…</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-ink-muted">No programs configured yet.</p>
      ) : (
        (data ?? []).map((p) => (
          <ProgramCard key={p.program.id} summary={p} onDone={() => qc.invalidateQueries({ queryKey: ["admin", "workshop-programs"] })} />
        ))
      )}
    </div>
  );
}

function ProgramCard({ summary, onDone }: { summary: ProgramSummary; onDone: () => void }) {
  const { program } = summary;
  const tz = program.timezone || "UTC";
  const target = program.target_future_occurrences;
  const healthy = summary.upcoming >= target && !program.last_error;

  const setActiveFn = useServerFn(setWorkshopProgramActive);
  const topUpFn = useServerFn(topUpWorkshopProgram);
  const cancelFutureFn = useServerFn(cancelWorkshopProgramFuture);
  const cancelOneFn = useServerFn(cancelProgramOccurrence);
  const updateFn = useServerFn(updateWorkshopProgram);

  const [editing, setEditing] = useState(false);
  const [perMonth, setPerMonth] = useState(String(program.events_per_month));
  const [horizon, setHorizon] = useState(String(program.target_future_occurrences));
  const [lead, setLead] = useState(String(program.min_lead_days));
  const [duration, setDuration] = useState(String(program.duration_minutes));

  const toggle = useMutation({
    mutationFn: (active: boolean) => setActiveFn({ data: { id: program.id, active } }),
    onSuccess: (r) => {
      toast.success(r.active ? "Automation resumed" : "Automation paused");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const topUp = useMutation({
    mutationFn: () => topUpFn({ data: { id: program.id } }),
    onSuccess: (r) => {
      toast.success(`${r.inserted} added${r.skipped ? `, ${r.skipped} skipped` : ""}`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelFuture = useMutation({
    mutationFn: () => cancelFutureFn({ data: { id: program.id } }),
    onSuccess: (r) => {
      toast.success(`Canceled ${r.canceled} upcoming events`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelOne = useMutation({
    mutationFn: (event_id: string) => cancelOneFn({ data: { event_id } }),
    onSuccess: () => {
      toast.success("Occurrence canceled");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: program.id,
          events_per_month: Number(perMonth) || program.events_per_month,
          target_future_occurrences: Number(horizon) || program.target_future_occurrences,
          min_lead_days: Number(lead),
          duration_minutes: Number(duration) || program.duration_minutes,
        },
      }),
    onSuccess: () => {
      toast.success("Program updated");
      setEditing(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pool = Object.entries(program.venue_config ?? {});

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg text-ink">{program.name}</h3>
            <Badge variant={program.active ? "default" : "secondary"}>
              {program.active ? "Active" : "Paused"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {program.events_per_month} per month · horizon {target} · {tz} ·{" "}
            {summary.group_slug ? `/g/${summary.group_slug}` : "no group"}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Home base: {getWorkshopVenue(program.home_base_venue_key)?.venue_name ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            Automation
            <Switch
              checked={program.active}
              onCheckedChange={(v) => toggle.mutate(v)}
              disabled={toggle.isPending}
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit program"}
          </Button>
          <Button size="sm" onClick={() => topUp.mutate()} disabled={topUp.isPending}>
            {topUp.isPending ? "Topping up…" : "Top up now"}
          </Button>
        </div>
      </div>

      <p className={`mt-3 text-sm ${healthy ? "text-ink-soft" : "text-destructive"}`}>
        {healthy
          ? `Active — ${summary.upcoming} future events scheduled`
          : `Needs attention — ${summary.upcoming} of ${target} scheduled`}
      </p>
      {program.last_error ? (
        <p className="mt-1 text-xs text-ink-muted">{program.last_error}</p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">
        Next: {fmt(summary.next_at, tz)} · Last run:{" "}
        {program.last_materialized_at ? fmt(program.last_materialized_at, tz) : "never"}
      </p>

      {editing ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
          <label className="text-xs text-ink-muted">
            Per month
            <Input value={perMonth} onChange={(e) => setPerMonth(e.target.value)} />
          </label>
          <label className="text-xs text-ink-muted">
            Horizon
            <Input value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </label>
          <label className="text-xs text-ink-muted">
            Lead days
            <Input value={lead} onChange={(e) => setLead(e.target.value)} />
          </label>
          <label className="text-xs text-ink-muted">
            Duration (min)
            <Input value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
          <div className="sm:col-span-4">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
            <span className="ml-2 text-xs text-ink-muted">
              Applies to newly materialized occurrences only.
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <h4 className="text-xs font-medium uppercase tracking-wider text-ink-muted">Venue pool</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {pool.map(([key, cfg]) => {
            const v = getWorkshopVenue(key);
            return (
              <span
                key={key}
                className="rounded-full border border-border px-3 py-1 text-xs text-ink-soft"
              >
                {v?.venue_name ?? key} · {cfg.capacity ?? "—"}
                {cfg.overflow ? `+${cfg.overflow}` : ""}
                {cfg.needs_review ? " · needs review" : ""}
                {!cfg.enabled ? " · off" : ""}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="py-2">When</th>
              <th>Venue</th>
              <th>RSVPs</th>
              <th>Capacity</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summary.occurrences.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-3 text-ink-muted">
                  No upcoming occurrences.
                </td>
              </tr>
            ) : (
              summary.occurrences.map((o) => {
                const venue = getWorkshopVenue(o.workshop_venue_key);
                const modified = !o.workshop_venue_key;
                return (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(o.starts_at, tz)}</td>
                    <td className="pr-3">
                      {o.venue_name ?? "—"}
                      {venue?.neighborhood ? (
                        <span className="block text-xs text-ink-muted">{venue.neighborhood}</span>
                      ) : null}
                    </td>
                    <td className="pr-3">{o.rsvp_count}</td>
                    <td className="pr-3">
                      {o.capacity ?? "—"}
                      {o.overflow ? `+${o.overflow}` : ""}
                    </td>
                    <td className="pr-3">
                      <span className="capitalize">{o.status}</span>
                      {modified ? (
                        <span className="ml-1 text-xs text-ink-muted">· modified</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {summary.group_slug ? (
                        <a
                          className="text-xs underline"
                          href={`/g/${summary.group_slug}/e/${o.slug}`}
                        >
                          View
                        </a>
                      ) : null}
                      {o.status !== "canceled" ? (
                        <button
                          className="ml-3 text-xs text-destructive underline"
                          onClick={() => cancelOne.mutate(o.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (
              confirm(
                `Cancel every upcoming ${program.name} occurrence and pause this program? Other programs are unaffected.`,
              )
            )
              cancelFuture.mutate();
          }}
          disabled={cancelFuture.isPending}
        >
          Cancel future {program.name} events
        </Button>

      </div>
    </section>
  );
}
